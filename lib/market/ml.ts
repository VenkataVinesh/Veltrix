/**
 * Learned models for the forecast ensemble.
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
 *   - GARCH volatility, which unlike direction genuinely IS predictable
 *
 * Every model still has to beat a naive random walk out of sample in
 * walkForward() before it earns any weight.
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
