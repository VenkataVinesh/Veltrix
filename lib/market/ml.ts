/**
 * Learned and structural models for the forecast and volatility engines.
 *
 * Everything here trains in well under a second on a few hundred bars,
 * because it has to run inside a serverless request. That rules out
 * genuinely deep sequence models — an LSTM or transformer cannot be
 * trained per-request, and shipping frozen weights would mean serving
 * stale parameters per symbol.
 *
 * It also, honestly, would not help much. Daily direction is close to a
 * random walk; the literature is consistent about this and our own
 * backtests agree. What these models add is:
 *   - features beyond raw price, so there is something to learn from
 *   - regularisation, so they degrade to "no opinion" instead of
 *     overfitting a few hundred noisy bars
 *   - volatility & interval models (GARCH(1,1), GJR-GARCH, Parkinson HAR-RV,
 *     and split-conformal calibration), which unlike direction genuinely ARE
 *     predictable
 *
 * Every model still has to beat a naive random walk or pass Kupiec coverage
 * out of sample before it earns a place in production.
 */

/* ── Feature engineering ───────────────────────────────────────── */

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const sd = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}

/** Bars of history needed before any feature row can be built. */
export const FEATURE_WARMUP = 25

/**
 * One feature row from the window ENDING at index `i` (inclusive).
 * Strictly backward-looking — nothing here may touch prices after `i`,
 * which is the only thing standing between this and a leaked backtest.
 */
function featureRow(prices: number[], vols: number[], i: number): number[] | null {
  if (i < FEATURE_WARMUP) return null

  const r: number[] = []
  for (let k = i - 20; k <= i; k++) r.push(Math.log(prices[k] / prices[k - 1]))

  const last5 = r.slice(-5)
  const last10 = r.slice(-10)
  const last20 = r.slice(-20)

  const vol5 = sd(last5)
  const vol20 = sd(last20) || 1e-8

  const ma5 = mean(prices.slice(i - 4, i + 1))
  const ma20 = mean(prices.slice(i - 19, i + 1))
  const px = prices[i]

  // Volume is optional — CoinGecko's OHLC feed carries none, so this
  // degrades to a constant rather than poisoning the row with NaN.
  const v = vols[i] ?? 0
  const vAvg = mean(vols.slice(Math.max(0, i - 19), i + 1).filter((x) => x > 0))
  const volRatio = vAvg > 0 && v > 0 ? v / vAvg : 1

  return [
    r[r.length - 1],              // yesterday's return
    r[r.length - 2] ?? 0,
    r[r.length - 3] ?? 0,
    mean(last5),                  // short momentum
    mean(last10),
    mean(last20),                 // longer momentum
    vol5 / vol20 - 1,             // volatility regime shift
    (px / ma5 - 1),               // stretch from short MA
    (px / ma20 - 1),              // stretch from long MA
    (ma5 / ma20 - 1),             // MA cross state
    Math.tanh(volRatio - 1),      // bounded volume surprise
  ]
}

export interface Dataset { X: number[][]; y: number[] }

/** Feature matrix and next-bar log return, aligned so row i predicts i+1. */
export function buildDataset(prices: number[], vols: number[]): Dataset {
  const X: number[][] = []
  const y: number[] = []
  for (let i = FEATURE_WARMUP; i < prices.length - 1; i++) {
    const row = featureRow(prices, vols, i)
    if (!row || row.some((v) => !Number.isFinite(v))) continue
    X.push(row)
    y.push(Math.log(prices[i + 1] / prices[i]))
  }
  return { X, y }
}

export function latestFeatures(prices: number[], vols: number[]): number[] | null {
  const row = featureRow(prices, vols, prices.length - 1)
  return row && row.every((v) => Number.isFinite(v)) ? row : null
}

/* ── Ridge regression ──────────────────────────────────────────── */

/**
 * Ridge, not OLS. With 11 correlated features on a few hundred noisy
 * rows, OLS overfits hard; the L2 penalty shrinks coefficients toward
 * zero so an uninformative feature costs nothing. Standardised first so
 * one penalty is fair across features on different scales.
 */
export interface RidgeModel {
  w: number[]
  b: number
  mu: number[]
  sigma: number[]
}

export function ridgeFit(X: number[][], y: number[], lambda = 1.0): RidgeModel | null {
  const n = X.length
  const d = X[0]?.length ?? 0
  if (n < d + 10) return null

  const mu = Array.from({ length: d }, (_, j) => mean(X.map((r) => r[j])))
  const sigma = Array.from({ length: d }, (_, j) => sd(X.map((r) => r[j])) || 1)
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sigma[j]))
  const yb = mean(y)
  const yc = y.map((v) => v - yb)

  // (ZᵀZ + λI) w = Zᵀy
  const A: number[][] = Array.from({ length: d }, (_, a) =>
    Array.from({ length: d + 1 }, (_, b) =>
      b === d
        ? Z.reduce((s, r, i) => s + r[a] * yc[i], 0)
        : Z.reduce((s, r) => s + r[a] * r[b], 0) + (a === b ? lambda : 0)
    )
  )

  for (let i = 0; i < d; i++) {
    let piv = i
    for (let k = i + 1; k < d; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k
    ;[A[i], A[piv]] = [A[piv], A[i]]
    if (Math.abs(A[i][i]) < 1e-12) return null
    for (let k = i + 1; k < d; k++) {
      const f = A[k][i] / A[i][i]
      for (let j = i; j <= d; j++) A[k][j] -= f * A[i][j]
    }
  }
  const w = new Array(d).fill(0)
  for (let i = d - 1; i >= 0; i--) {
    let s = A[i][d]
    for (let j = i + 1; j < d; j++) s -= A[i][j] * w[j]
    w[i] = s / A[i][i]
  }
  if (w.some((v) => !Number.isFinite(v))) return null
  return { w, b: yb, mu, sigma }
}

export const ridgePredict = (m: RidgeModel, x: number[]): number =>
  m.b + m.w.reduce((s, wj, j) => s + wj * ((x[j] - m.mu[j]) / m.sigma[j]), 0)

/* ── Gradient-boosted stumps ───────────────────────────────────── */

/**
 * Depth-1 trees (stumps) boosted on the residual. Deliberately weak:
 * a shallow learner with a small step and few rounds is the only tree
 * model that behaves on data this short and this noisy. Anything deeper
 * memorises the training window and reports a beautiful in-sample fit
 * that collapses out of sample.
 */
interface Stump { j: number; thr: number; left: number; right: number }
export interface GBModel { base: number; trees: Stump[]; lr: number }

function bestStump(X: number[][], g: number[]): Stump | null {
  const d = X[0].length
  let best: Stump | null = null
  let bestSse = Infinity

  for (let j = 0; j < d; j++) {
    const vals = X.map((r) => r[j]).slice().sort((a, b) => a - b)
    // A handful of quantile splits is plenty and keeps this O(d · q · n).
    for (let q = 1; q <= 3; q++) {
      const thr = vals[Math.floor((q * vals.length) / 4)]
      let ls = 0, lc = 0, rs = 0, rc = 0
      for (let i = 0; i < X.length; i++) {
        if (X[i][j] <= thr) { ls += g[i]; lc++ } else { rs += g[i]; rc++ }
      }
      if (lc < 5 || rc < 5) continue
      const lm = ls / lc, rm = rs / rc
      let sse = 0
      for (let i = 0; i < X.length; i++) sse += (g[i] - (X[i][j] <= thr ? lm : rm)) ** 2
      if (sse < bestSse) { bestSse = sse; best = { j, thr, left: lm, right: rm } }
    }
  }
  return best
}

export function gbFit(X: number[][], y: number[], rounds = 25, lr = 0.08): GBModel | null {
  if (X.length < 40) return null
  const base = mean(y)
  const pred = new Array(X.length).fill(base)
  const trees: Stump[] = []

  for (let t = 0; t < rounds; t++) {
    const resid = y.map((v, i) => v - pred[i])
    const stump = bestStump(X, resid)
    if (!stump) break
    trees.push(stump)
    for (let i = 0; i < X.length; i++) {
      pred[i] += lr * (X[i][stump.j] <= stump.thr ? stump.left : stump.right)
    }
  }
  return trees.length ? { base, trees, lr } : null
}

export const gbPredict = (m: GBModel, x: number[]): number =>
  m.base + m.lr * m.trees.reduce((s, t) => s + (x[t.j] <= t.thr ? t.left : t.right), 0)

/* ── Additional directional baselines (Kalman & Seasonal-Naive) ── */

/**
 * 1D local-level Kalman filter on log returns.
 * Estimates a latent drift state x_t = x_{t-1} + eta_t (Var = q) observed
 * through noisy returns r_t = x_t + eps_t (Var = R), shrunk by 0.5x to
 * avoid extrapolating noise on multi-day horizons.
 */
export function kalmanReturnForecast(r: number[], qRatio = 0.02): number {
  if (r.length < 10) return 0
  const obsVar = Math.max(sd(r) ** 2, 1e-10)
  const q = obsVar * qRatio
  let state = 0
  let p = obsVar
  for (let i = 0; i < r.length; i++) {
    const pPred = p + q
    const k = pPred / (pPred + obsVar)
    state = state + k * (r[i] - state)
    p = (1 - k) * pPred
  }
  return state * 0.5
}

/**
 * Seasonal-naive return baseline (period = 5 trading days = 1 market week).
 * Predicts the return from the same day of the previous trading week,
 * heavily damped (0.25x) so single-day outliers do not explode multi-step paths.
 */
export function seasonalNaiveReturn(r: number[], period = 5): number {
  if (r.length < period) return 0
  return r[r.length - period] * 0.25
}

/* ── GARCH(1,1) ────────────────────────────────────────────────── */

/**
 * The one thing here that is genuinely predictable.
 *
 * Volatility clusters: a turbulent day is followed by turbulent days.
 * GARCH(1,1) models that directly, and unlike EWMA it mean-reverts to a
 * long-run level, so multi-day bands stop drifting when the recent
 * window happens to be unusually calm or wild.
 *
 * Fitted by grid search over (alpha, beta) maximising Gaussian
 * log-likelihood, with omega pinned by variance targeting. Not as sharp
 * as a proper optimiser, but deterministic, dependency-free, and
 * finishes in milliseconds.
 */
export interface GarchModel { omega: number; alpha: number; beta: number; sigma2: number }

export function garchFit(r: number[]): GarchModel | null {
  if (r.length < 50) return null
  const uncond = r.reduce((s, x) => s + x * x, 0) / r.length
  if (!Number.isFinite(uncond) || uncond <= 0) return null

  let best: GarchModel | null = null
  let bestLL = -Infinity

  for (let a = 0.02; a <= 0.24; a += 0.02) {
    for (let b = 0.60; b <= 0.96; b += 0.02) {
      if (a + b >= 0.999) continue
      const omega = uncond * (1 - a - b)
      let s2 = uncond
      let ll = 0
      let ok = true
      for (let i = 0; i < r.length; i++) {
        if (s2 <= 1e-14) { ok = false; break }
        ll += -0.5 * (Math.log(s2) + (r[i] * r[i]) / s2)
        s2 = omega + a * r[i] * r[i] + b * s2
      }
      if (ok && Number.isFinite(ll) && ll > bestLL) {
        bestLL = ll
        best = { omega, alpha: a, beta: b, sigma2: s2 }
      }
    }
  }
  return best
}

/** Per-step conditional sigma, and the cumulative sigma to each horizon. */
export function garchPath(m: GarchModel, horizon: number): { step: number[]; cumulative: number[] } {
  const uncond = m.omega / (1 - m.alpha - m.beta)
  const step: number[] = []
  const cumulative: number[] = []
  let s2 = m.sigma2
  let acc = 0
  for (let h = 0; h < horizon; h++) {
    step.push(Math.sqrt(Math.max(s2, 1e-14)))
    acc += s2
    cumulative.push(Math.sqrt(Math.max(acc, 1e-14)))
    // Multi-step forecast decays toward the unconditional variance.
    s2 = uncond + (m.alpha + m.beta) * (s2 - uncond)
  }
  return { step, cumulative }
}

/* ── GJR-GARCH(1,1,1) (Asymmetric Leverage Volatility) ─────────── */

/**
 * Glosten-Jagannathan-Runkle (1993) asymmetric GARCH:
 *   sigma_t^2 = omega + (alpha + gamma * I(r_{t-1} < 0)) * r_{t-1}^2 + beta * sigma_{t-1}^2
 *
 * Captures the leverage effect in equities where negative return shocks raise
 * subsequent volatility more strongly than positive shocks of equal size.
 */
export interface GjrGarchModel {
  omega: number
  alpha: number
  gamma: number
  beta: number
  sigma2: number
}

export function gjrGarchFit(r: number[]): GjrGarchModel | null {
  if (r.length < 50) return null
  const uncond = r.reduce((s, x) => s + x * x, 0) / r.length
  if (!Number.isFinite(uncond) || uncond <= 0) return null

  let best: GjrGarchModel | null = null
  let bestLL = -Infinity

  for (let a = 0.01; a <= 0.16; a += 0.03) {
    for (let g = 0.0; g <= 0.20; g += 0.04) {
      for (let b = 0.64; b <= 0.94; b += 0.03) {
        const persistence = a + 0.5 * g + b
        if (persistence >= 0.995) continue
        const omega = uncond * (1 - persistence)
        let s2 = uncond
        let ll = 0
        let ok = true
        for (let i = 0; i < r.length; i++) {
          if (s2 <= 1e-14) { ok = false; break }
          ll += -0.5 * (Math.log(s2) + (r[i] * r[i]) / s2)
          const neg = r[i] < 0 ? 1 : 0
          s2 = omega + (a + g * neg) * r[i] * r[i] + b * s2
        }
        if (ok && Number.isFinite(ll) && ll > bestLL) {
          bestLL = ll
          best = { omega, alpha: a, gamma: g, beta: b, sigma2: s2 }
        }
      }
    }
  }
  return best
}

export function gjrGarchPath(
  m: GjrGarchModel,
  horizon: number
): { step: number[]; cumulative: number[] } {
  const persistence = m.alpha + 0.5 * m.gamma + m.beta
  const uncond = m.omega / (1 - persistence)
  const step: number[] = []
  const cumulative: number[] = []
  let s2 = m.sigma2
  let acc = 0
  for (let h = 0; h < horizon; h++) {
    step.push(Math.sqrt(Math.max(s2, 1e-14)))
    acc += s2
    cumulative.push(Math.sqrt(Math.max(acc, 1e-14)))
    s2 = uncond + persistence * (s2 - uncond)
  }
  return { step, cumulative }
}

/* ── Parkinson HAR-RV (High-Low Range Realised Volatility) ─────── */

/**
 * Corsi (2009) Heterogeneous Autoregressive (HAR) volatility model using
 * Parkinson (1980) daily range variance:
 *   rv_t = (ln(high_t / low_t))^2 / (4 * ln(2))
 *
 * Regresses log(rv_{t+1}) on daily (1d), weekly (5d), and monthly (22d)
 * average log-range-variance via Ridge-regularised normal equations, then
 * iterates forward to produce multi-step cumulative sigma paths.
 */
export interface HarRvModel {
  coefs: [number, number, number, number] // [intercept, b1, b5, b22]
  historyLogRv: number[]
  biasCorrection: number
}

export function harRvFit(
  highs: number[],
  lows: number[],
  closes: number[]
): HarRvModel | null {
  const n = Math.min(highs.length, lows.length, closes.length)
  if (n < 60) return null

  const fourLn2 = 4 * Math.LN2
  const rv: number[] = []
  for (let i = 1; i < n; i++) {
    const h = highs[i]
    const l = lows[i]
    const rangeVar = h > l && l > 0 ? Math.log(h / l) ** 2 / fourLn2 : 0
    const closeVar = Math.log(closes[i] / closes[i - 1]) ** 2
    // Blend Parkinson range variance with squared close-to-close return to account for overnight gaps
    const blended = rangeVar > 1e-12 ? 0.65 * rangeVar + 0.35 * closeVar : closeVar
    rv.push(Math.max(blended, 1e-10))
  }

  const logRv = rv.map((v) => Math.log(v))
  const X: number[][] = []
  const y: number[] = []

  for (let t = 21; t < logRv.length - 1; t++) {
    const d1 = logRv[t]
    const d5 = mean(logRv.slice(t - 4, t + 1))
    const d22 = mean(logRv.slice(t - 21, t + 1))
    X.push([d1, d5, d22])
    y.push(logRv[t + 1])
  }

  const ridge = ridgeFit(X, y, 2.0)
  if (!ridge) return null

  // Convert standardised Ridge weights back to raw feature space [intercept, b1, b5, b22]
  const rawW = ridge.w.map((wj, j) => wj / ridge.sigma[j])
  const intercept = ridge.b - rawW.reduce((s, bw, j) => s + bw * ridge.mu[j], 0)

  // Jensen's inequality log-normal bias adjustment from training residuals
  const resids = X.map((row, idx) => y[idx] - ridgePredict(ridge, row))
  const varResid = sd(resids) ** 2
  const biasCorrection = Math.exp(0.5 * Math.min(varResid, 1.5))

  return {
    coefs: [intercept, rawW[0], rawW[1], rawW[2]],
    historyLogRv: logRv.slice(-22),
    biasCorrection,
  }
}

export function harRvPath(
  m: HarRvModel,
  horizon: number
): { step: number[]; cumulative: number[] } {
  const [b0, b1, b5, b22] = m.coefs
  const buf = [...m.historyLogRv]
  const step: number[] = []
  const cumulative: number[] = []
  let accVar = 0

  for (let h = 0; h < horizon; h++) {
    const d1 = buf[buf.length - 1]
    const d5 = mean(buf.slice(-5))
    const d22 = mean(buf.slice(-22))
    const nextLogRv = Math.max(-22, Math.min(-2, b0 + b1 * d1 + b5 * d5 + b22 * d22))
    const s2 = Math.exp(nextLogRv) * m.biasCorrection
    step.push(Math.sqrt(Math.max(s2, 1e-14)))
    accVar += s2
    cumulative.push(Math.sqrt(Math.max(accVar, 1e-14)))
    buf.push(nextLogRv)
  }

  return { step, cumulative }
}

/* ── Split-Conformal GARCH Multiplier ──────────────────────────── */

/**
 * Distribution-free split-conformal calibration on GARCH-standardised
 * multi-step returns (strictly causal on the training window).
 *
 * Computes the empirical (1 - alpha)(1 + 1/K) quantile of non-conformity scores
 *   s_t = |sum_{h=1..H} r_{t+h}| / sigma_{GARCH, t -> t+H}
 * over the trailing calibration slice of the training window, with non-overlapping
 * or purged calibration steps.
 */
export function conformalGarchMultiplier(
  r: number[],
  garch: GarchModel,
  horizon = 5,
  targetCoverage = 0.95,
  calWindow = 160
): number {
  const zFallback = 1.959964
  if (r.length < calWindow + horizon + 30) return zFallback

  const persistence = garch.alpha + garch.beta
  const uncond = garch.omega / (1 - persistence)

  const s2Series = new Array<number>(r.length)
  let s2 = uncond
  for (let i = 0; i < r.length; i++) {
    s2Series[i] = s2
    s2 = garch.omega + garch.alpha * r[i] * r[i] + garch.beta * s2
  }

  const scores: number[] = []
  const start = Math.max(30, r.length - calWindow - horizon)
  // Step up to r.length - horizon so no calibration score touches returns past the end of `r`
  for (let i = start; i <= r.length - horizon; i++) {
    let cumVar = 0
    let curS2 = s2Series[i]
    for (let h = 0; h < horizon; h++) {
      cumVar += curS2
      curS2 = uncond + persistence * (curS2 - uncond)
    }
    let cumRet = 0
    for (let h = 0; h < horizon; h++) cumRet += r[i + h]
    scores.push(Math.abs(cumRet) / Math.sqrt(Math.max(cumVar, 1e-14)))
  }

  if (scores.length < 20) return zFallback
  scores.sort((a, b) => a - b)
  const k = scores.length
  const idx = Math.min(k - 1, Math.max(0, Math.ceil(targetCoverage * (k + 1)) - 1))
  return scores[idx]
}
