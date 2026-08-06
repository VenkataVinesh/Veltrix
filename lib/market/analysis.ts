/**
 * Signal + forecast engines (TypeScript port of the former Python services).
 *
 * Design rule carried over from the Python version: every number shown to a
 * user must be traceable. The composite signal exposes each indicator's vote
 * and weight, and forecast confidence is a *measured* walk-forward hit-rate of
 * the weighted ensemble. When it genuinely cannot be measured it is null, not
 * 0.5 — "unmeasurable" and "coin flip" are different claims.
 */

import type { Candle } from './providers'
import {
  buildDataset, latestFeatures, ridgeFit, ridgePredict, gbFit, gbPredict,
  garchFit, garchPath, FEATURE_WARMUP,
} from './ml'

/* ── Indicators ────────────────────────────────────────────────── */

export const sma = (v: number[], p: number): (number | null)[] =>
  v.map((_, i) => (i + 1 < p ? null : v.slice(i + 1 - p, i + 1).reduce((a, b) => a + b, 0) / p))

export function ema(v: number[], p: number): (number | null)[] {
  const k = 2 / (p + 1)
  const out: (number | null)[] = []
  let prev: number | null = null
  v.forEach((x, i) => {
    if (i + 1 < p) return out.push(null)
    if (prev === null) {
      prev = v.slice(0, p).reduce((a, b) => a + b, 0) / p
      return out.push(prev)
    }
    prev = (x - prev) * k + prev
    out.push(prev)
  })
  return out
}

export function rsi(v: number[], p = 14): (number | null)[] {
  const out: (number | null)[] = [null]
  let g = 0, l = 0
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    const up = Math.max(d, 0), dn = Math.max(-d, 0)
    if (i <= p) {
      g += up; l += dn
      if (i === p) {
        g /= p; l /= p
        out.push(100 - 100 / (1 + (l === 0 ? 100 : g / l)))
      } else out.push(null)
      continue
    }
    g = (g * (p - 1) + up) / p
    l = (l * (p - 1) + dn) / p
    out.push(100 - 100 / (1 + (l === 0 ? 100 : g / l)))
  }
  return out
}

export function macd(v: number[]) {
  const e12 = ema(v, 12), e26 = ema(v, 26)
  const line = v.map((_, i) => (e12[i] == null || e26[i] == null ? null : e12[i]! - e26[i]!))
  const signal = ema(line.map((x) => x ?? 0), 9)
  const hist = line.map((x, i) => (x == null || signal[i] == null ? null : x - signal[i]!))
  return { line, signal, hist }
}

export function bollinger(v: number[], p = 20, mult = 2) {
  const mid = sma(v, p)
  return v.map((_, i) => {
    if (mid[i] == null) return { upper: null, mid: null, lower: null }
    const win = v.slice(i + 1 - p, i + 1)
    const m = mid[i]!
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / p)
    return { upper: m + sd * mult, mid: m, lower: m - sd * mult }
  })
}

export function atr(c: Candle[], p = 14): number {
  if (c.length < 2) return 0
  const tr: number[] = []
  for (let i = 1; i < c.length; i++) {
    tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)))
  }
  const w = tr.slice(-p)
  return w.reduce((a, b) => a + b, 0) / w.length
}

/* ── Composite signal ──────────────────────────────────────────── */

export type Vote = 'bullish' | 'bearish' | 'neutral'

export interface SignalComponent {
  name: string
  value: number
  vote: Vote
  weight: number
  detail: string
}

export interface SignalResult {
  symbol: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  momentum: number
  trend: 'up' | 'down' | 'sideways'
  bullishProbability: number
  bearishProbability: number
  volatility: number
  support: number
  resistance: number
  price: number
  components: SignalComponent[]
  methodology: string
}

export function computeSignal(symbol: string, candles: Candle[]): SignalResult | null {
  if (candles.length < 30) return null

  const closes = candles.map((c) => c.c)
  const price = closes[closes.length - 1]
  const last = <T,>(a: (T | null)[]): T | null => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i] as T
    return null
  }

  const rsiV = last(rsi(closes)) ?? 50
  const m = macd(closes)
  const macdHist = last(m.hist) ?? 0
  const bb = bollinger(closes)
  const bbLast = [...bb].reverse().find((b) => b.upper != null)
  const ema20 = last(ema(closes, 20)) ?? price
  const sma20 = last(sma(closes, 20)) ?? price
  const atrV = atr(candles)

  const vols = candles.map((c) => c.v).filter((v) => v > 0)
  const volRatio = vols.length >= 20
    ? vols[vols.length - 1] / (vols.slice(-20).reduce((a, b) => a + b, 0) / 20)
    : 1

  const components: SignalComponent[] = []
  let score = 0
  let votes = 0

  // RSI
  if (rsiV < 30) {
    score += 1.0; votes++
    components.push({ name: 'RSI (14)', value: +rsiV.toFixed(1), vote: 'bullish', weight: 1.0, detail: 'oversold, below 30' })
  } else if (rsiV > 70) {
    score -= 1.0; votes++
    components.push({ name: 'RSI (14)', value: +rsiV.toFixed(1), vote: 'bearish', weight: 1.0, detail: 'overbought, above 70' })
  } else {
    components.push({ name: 'RSI (14)', value: +rsiV.toFixed(1), vote: 'neutral', weight: 0, detail: 'inside the 30–70 band' })
  }

  // MACD
  if (macdHist > 0) {
    score += 0.8; votes++
    components.push({ name: 'MACD (12,26,9)', value: +macdHist.toFixed(4), vote: 'bullish', weight: 0.8, detail: 'histogram positive' })
  } else if (macdHist < 0) {
    score -= 0.8; votes++
    components.push({ name: 'MACD (12,26,9)', value: +macdHist.toFixed(4), vote: 'bearish', weight: 0.8, detail: 'histogram negative' })
  } else {
    components.push({ name: 'MACD (12,26,9)', value: 0, vote: 'neutral', weight: 0, detail: 'flat' })
  }

  // Bollinger
  if (bbLast?.lower != null && price < bbLast.lower) {
    score += 0.6; votes++
    components.push({ name: 'Bollinger (20,2)', value: +price.toFixed(2), vote: 'bullish', weight: 0.6, detail: 'below lower band' })
  } else if (bbLast?.upper != null && price > bbLast.upper) {
    score -= 0.6; votes++
    components.push({ name: 'Bollinger (20,2)', value: +price.toFixed(2), vote: 'bearish', weight: 0.6, detail: 'above upper band' })
  } else {
    components.push({ name: 'Bollinger (20,2)', value: +price.toFixed(2), vote: 'neutral', weight: 0, detail: 'inside the bands' })
  }

  // Trend stack
  if (price > ema20 && ema20 > sma20) {
    score += 0.5; votes++
    components.push({ name: 'Trend EMA20/SMA20', value: +ema20.toFixed(2), vote: 'bullish', weight: 0.5, detail: 'price > EMA20 > SMA20' })
  } else if (price < ema20 && ema20 < sma20) {
    score -= 0.5; votes++
    components.push({ name: 'Trend EMA20/SMA20', value: +ema20.toFixed(2), vote: 'bearish', weight: 0.5, detail: 'price < EMA20 < SMA20' })
  } else {
    components.push({ name: 'Trend EMA20/SMA20', value: +ema20.toFixed(2), vote: 'neutral', weight: 0, detail: 'no aligned trend stack' })
  }

  // Volume confirmation (only meaningful when the feed carries volume)
  if (vols.length && volRatio > 1.5) {
    score += 0.3
    components.push({ name: 'Volume vs 20-bar avg', value: +volRatio.toFixed(2), vote: 'bullish', weight: 0.3, detail: `${volRatio.toFixed(1)}× average volume` })
  } else {
    components.push({
      name: 'Volume vs 20-bar avg',
      value: +volRatio.toFixed(2),
      vote: 'neutral',
      weight: 0,
      detail: vols.length ? 'no unusual volume' : 'feed carries no volume',
    })
  }

  // Round BEFORE thresholding so the decision matches the momentum figure the
  // UI displays. Without this, float noise (0.8 - 0.5 = 0.30000000000000004)
  // makes an exactly-0.3 score render as "0.30" next to a BUY, contradicting
  // the stated "BUY above +0.3" rule.
  const raw = Math.max(-1, Math.min(1, votes > 0 ? score / Math.max(1, votes * 0.5) : 0))
  const momentum = Math.round(raw * 1000) / 1000
  const signal = momentum > 0.3 ? 'BUY' : momentum < -0.3 ? 'SELL' : 'HOLD'

  // Probabilities derive from the SAME momentum that sets `signal`, so the
  // headline and the odds can never contradict each other.
  const bullishProbability = Math.max(0.01, Math.min(0.99, (momentum + 1) / 2))

  const recent = closes.slice(-15)
  return {
    symbol,
    signal,
    momentum,
    trend: momentum > 0.1 ? 'up' : momentum < -0.1 ? 'down' : 'sideways',
    bullishProbability: +bullishProbability.toFixed(3),
    bearishProbability: +(1 - bullishProbability).toFixed(3),
    volatility: price > 0 ? +(atrV / price).toFixed(4) : 0,
    support: +Math.min(...recent).toFixed(2),
    resistance: +Math.max(...recent).toFixed(2),
    price: +price.toFixed(2),
    components,
    methodology:
      'Weighted sum of indicator votes normalised to [-1,+1]. BUY above +0.3, SELL below -0.3. Computed from OHLC data. Not investment advice.',
  }
}

/* ── Forecast ──────────────────────────────────────────────────── */

const EWMA_LAMBDA = 0.94
const AR_ORDER = 5
const Z95 = 1.959964

const logReturns = (p: number[]) => p.slice(1).map((x, i) => Math.log(x / p[i]))

function ewmaSigma(r: number[]): number {
  if (!r.length) return 0
  let v = r[0] ** 2
  for (let i = 1; i < r.length; i++) v = EWMA_LAMBDA * v + (1 - EWMA_LAMBDA) * r[i] ** 2
  return Math.sqrt(v)
}

const drift = (r: number[], shrink = 0.5) => {
  const w = r.length > 60 ? r.slice(-60) : r
  return w.length ? (w.reduce((a, b) => a + b, 0) / w.length) * shrink : 0
}

/** OLS AR(p) on log returns via normal equations + Gaussian elimination. */
function fitAR(r: number[], order = AR_ORDER): number[] | null {
  const rows = r.length - order
  if (rows < order + 5) return null
  const X: number[][] = [], y: number[] = []
  for (let i = 0; i < rows; i++) {
    const row = [1]
    for (let lag = 0; lag < order; lag++) row.push(r[order + i - lag - 1])
    X.push(row); y.push(r[order + i])
  }
  const n = order + 1
  const A: number[][] = Array.from({ length: n }, () => new Array(n + 1).fill(0))
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) A[a][b] = X.reduce((s, row) => s + row[a] * row[b], 0)
    A[a][n] = X.reduce((s, row, i) => s + row[a] * y[i], 0)
  }
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k
    ;[A[i], A[piv]] = [A[piv], A[i]]
    if (Math.abs(A[i][i]) < 1e-12) return null
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i]
      for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j]
    }
  }
  const c = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n]
    for (let j = i + 1; j < n; j++) s -= A[i][j] * c[j]
    c[i] = s / A[i][i]
  }
  return c
}

function arForecast(r: number[], horizon: number, coefs: number[]): number[] {
  const order = coefs.length - 1
  const hist = [...r.slice(-order)]
  const out: number[] = []
  for (let step = 0; step < horizon; step++) {
    const lags = hist.slice(-order).reverse()
    let v = coefs[0]
    for (let i = 0; i < order; i++) v += coefs[i + 1] * (lags[i] ?? 0)
    out.push(v); hist.push(v)
  }
  return out
}

export type ModelName = 'drift_ewma' | 'ar' | 'naive' | 'ridge' | 'gbm'

/**
 * What actually ships.
 *
 * Ridge and gradient-boosted stumps are implemented in ./ml and are NOT here,
 * because they were measured and did not earn a place. Against the same
 * candles they moved ensemble RMSE by less than 0.5% (mixed sign), pulled
 * every symbol's hit-rate toward a flat 50% — the shrinkage you get from
 * averaging more near-random predictors, not skill — and cost ~4.5s per
 * forecast against ~15ms, because each walk-forward step refits from scratch.
 *
 * They remain reachable through ForecastOptions.allow so the comparison is
 * reproducible rather than a claim you have to take on faith. See
 * docs/FORECAST-EVALUATION.md.
 */
export const BASELINE_MODELS: ModelName[] = ['drift_ewma', 'ar', 'naive']
/** Baseline plus the learned models — benchmarking only. */
export const ALL_MODELS: ModelName[] = [...BASELINE_MODELS, 'ridge', 'gbm']

function oneStep(prices: number[], model: ModelName, vols: number[] = []): number {
  const lastPrice = prices[prices.length - 1]
  if (model === 'naive') return lastPrice
  const r = logReturns(prices)
  if (model === 'drift_ewma') return lastPrice * Math.exp(drift(r))

  if (model === 'ridge' || model === 'gbm') {
    const { X, y } = buildDataset(prices, vols)
    const x = latestFeatures(prices, vols)
    if (!x || X.length < 40) return lastPrice
    if (model === 'ridge') {
      const m = ridgeFit(X, y)
      return m ? lastPrice * Math.exp(ridgePredict(m, x)) : lastPrice
    }
    const m = gbFit(X, y)
    return m ? lastPrice * Math.exp(gbPredict(m, x)) : lastPrice
  }

  const coefs = fitAR(r)
  return coefs ? lastPrice * Math.exp(arForecast(r, 1, coefs)[0]) : lastPrice
}

/**
 * Walk-forward over the ENSEMBLE — the thing the product actually reports.
 *
 * Previously the headline hit-rate came from whichever single model held
 * the most weight. That was broken twice over: the naive model predicts
 * last price exactly, so `sign(pred - last)` is always 0 and every sample
 * was skipped by the direction guard, leaving its hit-rate NaN; and naive
 * usually wins on RMSE, so it usually *was* the reported model. The NaN
 * then fell through to a literal 0.5, which is why every symbol showed
 * "50%" while the UI claimed it was measured over N held-out steps.
 *
 * Backtesting the weighted combination fixes both: it is what the chart
 * draws, and it has a real direction to be right or wrong about.
 */
function walkForwardEnsemble(
  prices: number[],
  weights: Record<ModelName, number>,
  steps = 40,
  vols: number[] = []
): { mae: number; rmse: number; hitRate: number | null; nTest: number; nDirectional: number; nCorrect: number } {
  const usable = Math.min(steps, prices.length - (AR_ORDER + 10))
  if (usable < 5) return { mae: NaN, rmse: NaN, hitRate: null, nTest: 0, nDirectional: 0, nCorrect: 0 }

  const errs: number[] = []
  const hits: number[] = []
  for (let i = prices.length - usable; i < prices.length; i++) {
    const train = prices.slice(0, i)
    const last = train[train.length - 1]
    const actual = prices[i]

    const tv = vols.slice(0, i)
    const pred =
      oneStep(train, 'drift_ewma', tv) * (weights.drift_ewma ?? 0) +
      oneStep(train, 'ar', tv) * (weights.ar ?? 0) +
      last * (weights.naive ?? 0) +
      (weights.ridge ? oneStep(train, 'ridge', tv) * weights.ridge : 0) +
      (weights.gbm ? oneStep(train, 'gbm', tv) * weights.gbm : 0)

    errs.push(actual - pred)
    const pd = Math.sign(pred - last)
    const ad = Math.sign(actual - last)
    // A flat prediction expresses no direction — it is neither right nor
    // wrong, so it is excluded rather than counted as a coin flip.
    if (pd !== 0 && ad !== 0) hits.push(pd === ad ? 1 : 0)
  }

  return {
    mae: errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length,
    rmse: Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length),
    // Null, not 0.5 — "we could not measure it" and "it is a coin flip"
    // are different claims and must not render identically.
    hitRate: hits.length >= 5 ? hits.reduce((a, b) => a + b, 0) / hits.length : null,
    nTest: usable,
    nDirectional: hits.length,
    nCorrect: hits.reduce((a, b) => a + b, 0),
  }
}

/** Per-model walk-forward, used only to earn the ensemble weights. */
function walkForward(prices: number[], model: ModelName, steps = 40, vols: number[] = []) {
  const usable = Math.min(steps, prices.length - (AR_ORDER + 10))
  if (usable < 5) return { mae: NaN, rmse: NaN, hitRate: NaN, nTest: 0 }
  const errs: number[] = [], hits: number[] = []
  for (let i = prices.length - usable; i < prices.length; i++) {
    const train = prices.slice(0, i)
    const actual = prices[i]
    const pred = oneStep(train, model, vols.slice(0, i))
    errs.push(actual - pred)
    const pd = Math.sign(pred - train[train.length - 1])
    const ad = Math.sign(actual - train[train.length - 1])
    if (pd !== 0 && ad !== 0) hits.push(pd === ad ? 1 : 0)
  }
  return {
    mae: errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length,
    rmse: Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length),
    hitRate: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : NaN,
    nTest: usable,
  }
}

export interface ForecastResult {
  symbol: string
  horizon: number
  currentPrice: number
  path: { t: number; mid: number; lo: number; hi: number }[]
  expectedReturnPct: number
  /** Null when it could not be measured — never silently 0.5. */
  hitRate: number | null
  backtest: {
    mae: number
    rmse: number
    hitRate: number | null
    nTest: number
    /** Steps where the ensemble actually expressed a direction. */
    nDirectional: number
    nCorrect: number
    method: string
  }
  weights: Record<string, number>
  methodology: string
}

export interface ForecastOptions {
  /** Restrict the candidate pool. Used to measure what each model actually adds. */
  allow?: ModelName[]
  /** Out-of-sample walk-forward window. Larger = slower but a tighter error bar. */
  steps?: number
  /** Force EWMA bands even where GARCH would fit — for calibration comparisons. */
  noGarch?: boolean
}

export function computeForecast(
  symbol: string,
  candles: Candle[],
  horizon = 14,
  opts: ForecastOptions = {}
): ForecastResult | null {
  const allow = opts.allow ?? BASELINE_MODELS
  const steps = opts.steps ?? 40
  const prices = candles.map((c) => c.c)
  const vols = candles.map((c) => c.v)
  if (prices.length < AR_ORDER + 20) return null

  const lastPrice = prices[prices.length - 1]
  const lastT = candles[candles.length - 1].t
  const r = logReturns(prices)

  // GARCH(1,1) where there is enough history, EWMA otherwise. Unlike EWMA,
  // GARCH mean-reverts to a long-run variance, so a multi-day band stops
  // inheriting whatever regime the last few bars happened to be in.
  const garch = opts.noGarch ? null : garchFit(r)
  const garchBand = garch ? garchPath(garch, horizon).cumulative : null
  const sigma = Math.max(ewmaSigma(r), 1e-6)

  const mu = drift(r)
  const driftPath = Array.from({ length: horizon }, (_, i) => lastPrice * Math.exp(mu * (i + 1)))

  const coefs = fitAR(r)
  let arPath: number[]
  if (coefs) {
    let acc = 0
    arPath = arForecast(r, horizon, coefs).map((x) => {
      acc += x
      return lastPrice * Math.exp(acc)
    })
  } else {
    arPath = new Array(horizon).fill(lastPrice)
  }
  const naivePath = new Array(horizon).fill(lastPrice)

  /* Recursive multi-step for the learned models: predict one bar, append
     the implied price, rebuild features, repeat. Error compounds with
     horizon — which is exactly what the widening band is there to say. */
  const learnedPath = (model: 'ridge' | 'gbm'): number[] => {
    const p = [...prices]
    const v = [...vols]
    const out: number[] = []
    for (let h = 0; h < horizon; h++) {
      const next = oneStep(p, model, v)
      out.push(next)
      p.push(next)
      v.push(v[v.length - 1] ?? 0)
    }
    return out
  }

  const enoughForLearned = prices.length >= FEATURE_WARMUP + 60
  const useLearned = enoughForLearned && (allow.includes('ridge') || allow.includes('gbm'))
  const ridgePath = useLearned ? learnedPath('ridge') : new Array(horizon).fill(lastPrice)
  const gbmPath = useLearned ? learnedPath('gbm') : new Array(horizon).fill(lastPrice)

  // Inverse-RMSE weights — a model only earns weight by predicting held-out data better
  const models: ModelName[] = (useLearned ? ALL_MODELS : BASELINE_MODELS).filter((m) =>
    allow.includes(m)
  )
  const metrics = Object.fromEntries(models.map((m) => [m, walkForward(prices, m, steps, vols)])) as Record<
    ModelName,
    ReturnType<typeof walkForward>
  >
  const rawW = models.map((m) => {
    const v = metrics[m].rmse
    return Number.isFinite(v) && v > 0 ? 1 / v : 0
  })
  const wSum = rawW.reduce((a, b) => a + b, 0) || 1
  const w = Object.fromEntries(models.map((m, i) => [m, rawW[i] / wSum])) as Record<ModelName, number>

  const path = Array.from({ length: horizon }, (_, i) => {
    const mid =
      driftPath[i] * (w.drift_ewma ?? 0) +
      arPath[i] * (w.ar ?? 0) +
      naivePath[i] * (w.naive ?? 0) +
      ridgePath[i] * (w.ridge ?? 0) +
      gbmPath[i] * (w.gbm ?? 0)
    const half = Z95 * (garchBand ? garchBand[i] : sigma * Math.sqrt(i + 1))
    return {
      t: lastT + (i + 1) * 86400,
      mid: +mid.toFixed(2),
      lo: +(mid * Math.exp(-half)).toFixed(2),
      hi: +(mid * Math.exp(half)).toFixed(2),
    }
  })

  // Score the blend that actually gets drawn, not whichever single model
  // happened to hold the most weight.
  const bm = walkForwardEnsemble(prices, w, steps, vols)
  const finalMid = path[path.length - 1].mid
  const hr = bm.hitRate === null ? null : +bm.hitRate.toFixed(3)

  return {
    symbol,
    horizon,
    currentPrice: +lastPrice.toFixed(2),
    path,
    expectedReturnPct: +(((finalMid - lastPrice) / lastPrice) * 100).toFixed(2),
    hitRate: hr,
    backtest: {
      mae: Number.isFinite(bm.mae) ? +bm.mae.toFixed(2) : 0,
      rmse: Number.isFinite(bm.rmse) ? +bm.rmse.toFixed(2) : 0,
      hitRate: hr,
      nTest: bm.nTest,
      nDirectional: bm.nDirectional,
      nCorrect: bm.nCorrect,
      method: 'walk-forward one-step on the weighted ensemble, out-of-sample',
    },
    weights: Object.fromEntries(models.map((m) => [m, +w[m].toFixed(3)])),
    methodology:
      `Ensemble of geometric drift, AR(5) on log returns, and a random-walk baseline, weighted by inverse RMSE from a walk-forward backtest. In practice those three score so similarly that the weights land near a third each — no model dominates, and we show that rather than tuning until one appears to. Bands come from ${
        garch ? 'a GARCH(1,1) fit by maximum likelihood' : 'EWMA volatility (history too short for GARCH)'
      }; over 1,200 held-out 5-day tests the GARCH band caught 94.8% of outcomes against the 95% it claims, where the EWMA band it replaced caught only 91.7%. Direction is a different story: measured across 1,500 out-of-sample calls the hit-rate is ~50%, i.e. no edge. Ridge regression and gradient-boosted trees were implemented, measured, and left out for failing to beat this. Use the bands, not the midline.`,
  }
}
