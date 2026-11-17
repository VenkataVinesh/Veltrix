/**
 * Walk-forward evaluation harness & offline benchmark results.
 *
 * This module is the referee:
 * 1. It holds the executable walk-forward directional and interval-coverage
 *    harnesses (with purging/embargo for multi-step horizons, flat-prediction
 *    exclusion, Kupiec POF and Christoffersen independence tests, Winkler
 *    interval scoring, QLIKE volatility loss, and multiple-testing correction).
 * 2. It exports the measured offline benchmark figures from
 *    docs/FORECAST-EVALUATION.md so every surface in the UI reads one source.
 */

export const DIRECTION = {
  /** Pooled directional hit-rate over out-of-sample walk-forward calls. */
  hitRate: 0.502,
  correct: 753,
  calls: 1500,
  /** Standard error at n = 1,500, in percentage points. */
  sePp: 1.29,
  z: 0.16,
  verdict: 'NO EDGE' as const,
  perSymbol: [
    { symbol: 'AAPL', hitRate: 0.512, n: 250 },
    { symbol: 'NVDA', hitRate: 0.5, n: 250 },
    { symbol: 'MSFT', hitRate: 0.524, n: 250 },
    { symbol: 'TSLA', hitRate: 0.48, n: 250 },
    { symbol: 'SPY', hitRate: 0.5, n: 250 },
    { symbol: 'AMZN', hitRate: 0.496, n: 250 },
  ],
}

export const CALIBRATION = {
  target: 0.95,
  /** 1,200 held-out 5-day forecasts. */
  tests: 1200,
  ewma: { coverage: 0.9167, widthPct: 16.23 },
  garch: { coverage: 0.9475, widthPct: 17.84 },
}

export const REJECTED_MODELS = {
  models: ['Ridge regression (11 features)', 'Gradient-boosted stumps'],
  slowdown: '123–443×',
}

export const EVALUATION_DOC =
  'https://github.com/VenkataVinesh/Veltrix/blob/main/docs/FORECAST-EVALUATION.md'

/** Two-sided 95% margin of error for a hit-rate at n calls, in percentage points. */
export const marginPp = (n: number) => 196 * Math.sqrt(0.25 / Math.max(n, 1))

/** True when a hit-rate cannot be told apart from a coin flip at 95%. */
export const indistinguishableFromChance = (hitRate: number, n: number) =>
  Math.abs(hitRate - 0.5) * 100 < marginPp(n)

/* ── Statistical & Multiple-Testing Utilities ──────────────────── */

/** Standard normal survival function P(Z > z) for z >= 0 (Abramowitz & Stegun 7.1.26). */
export function normalSurvival(z: number): number {
  if (!Number.isFinite(z)) return 0.5
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erfc =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
    Math.exp(-x * x)
  const pUpper = 0.5 * erfc
  return z >= 0 ? pUpper : 1 - pUpper
}

/** Two-sided p-value from a standard normal z-statistic. */
export const twoSidedPValue = (z: number): number =>
  Math.min(1, 2 * normalSurvival(Math.abs(z)))

/**
 * Chi-square survival function P(X²_df > x) for df = 1 or df = 2.
 * Used by Kupiec (df = 1), Christoffersen independence (df = 1), and
 * Christoffersen conditional coverage (df = 2) likelihood-ratio tests.
 */
export function chiSquarePValue(stat: number, df: 1 | 2): number {
  if (!Number.isFinite(stat) || stat <= 0) return 1
  if (df === 1) return twoSidedPValue(Math.sqrt(stat))
  // For df = 2, the chi-square distribution is Exponential(1/2): P(X > x) = exp(-x/2).
  return Math.exp(-0.5 * stat)
}

/**
 * Holm-Bonferroni step-down multiple-testing adjustment for a family of p-values.
 * Controls family-wise error rate (FWER) across M candidate models.
 */
export function holmBonferroni(pValues: number[]): number[] {
  const m = pValues.length
  if (!m) return []
  const indexed = pValues.map((p, idx) => ({ p: Math.max(0, Math.min(1, p)), idx }))
  indexed.sort((a, b) => a.p - b.p)

  const adjusted = new Array<number>(m).fill(1)
  let runningMax = 0
  for (let k = 0; k < m; k++) {
    const rawAdj = Math.min(1, indexed[k].p * (m - k))
    runningMax = Math.max(runningMax, rawAdj)
    adjusted[indexed[k].idx] = runningMax
  }
  return adjusted
}

/** Šidák-corrected two-sided family-wise significance threshold alpha_M = 1 - (1 - alpha)^(1/M). */
export const sidakAlpha = (alpha = 0.05, trials = 1): number =>
  1 - Math.pow(1 - alpha, 1 / Math.max(1, trials))

/* ── Purged Walk-Forward Directional Referee ───────────────────── */

export interface WalkForwardOptions {
  /** Number of out-of-sample evaluation steps from the end of the series. */
  steps?: number
  /** Forecast horizon in bars (default 1). */
  horizon?: number
  /** Minimum training warmup bars before the first evaluation step. */
  minWarmup?: number
  /**
   * Purged embargo bars dropped from the end of the training window before
   * fitting (López de Prado, AFML Ch. 7). When horizon > 1, multi-bar labels
   * near the end of the training window overlap the test bar unless purged.
   */
  embargoBars?: number
}

export interface WalkForwardSummary {
  mae: number
  rmse: number
  hitRate: number | null
  nTest: number
  nDirectional: number
  nCorrect: number
  sePp: number
  z: number
  pValue: number
  ci95: [number, number] | null
}

/**
 * Strictly causal walk-forward referee.
 *
 * At step `i`, the predictor receives a defensive copy of `prices.slice(0, trainEnd)`
 * where `trainEnd = i - embargoBars`. It can never see `prices[i]` or beyond.
 * Flat predictions (`Math.sign(pred - anchor) === 0`) are excluded from
 * `nDirectional` rather than scored as coin flips.
 */
export function evaluateWalkForward(
  prices: number[],
  predictor: (trainPrices: number[], trainVols: number[]) => number,
  vols: number[] = [],
  opts: WalkForwardOptions = {}
): WalkForwardSummary {
  const steps = opts.steps ?? 40
  const horizon = Math.max(1, opts.horizon ?? 1)
  const minWarmup = Math.max(5, opts.minWarmup ?? 15)
  const embargoBars = Math.max(0, opts.embargoBars ?? (horizon > 1 ? horizon - 1 : 0))

  const maxEvaluatable = prices.length - minWarmup - embargoBars - horizon + 1
  const usable = Math.min(steps, maxEvaluatable)
  if (usable < 5) {
    return {
      mae: NaN,
      rmse: NaN,
      hitRate: null,
      nTest: 0,
      nDirectional: 0,
      nCorrect: 0,
      sePp: NaN,
      z: 0,
      pValue: 1,
      ci95: null,
    }
  }

  const startAnchor = prices.length - horizon - usable
  const errs: number[] = []
  const hits: number[] = []

  for (let step = 0; step < usable; step++) {
    const anchorIdx = startAnchor + step
    const targetIdx = anchorIdx + horizon
    const trainEnd = anchorIdx + 1 - embargoBars

    // Defensive copies prevent a buggy predictor from mutating the caller's array.
    const trainPrices = prices.slice(0, trainEnd)
    const trainVols = vols.slice(0, trainEnd)
    const anchorPrice = trainPrices[trainPrices.length - 1]
    const actual = prices[targetIdx]

    const pred = predictor(trainPrices, trainVols)
    if (!Number.isFinite(pred)) continue

    errs.push(actual - pred)
    const pd = Math.sign(pred - anchorPrice)
    const ad = Math.sign(actual - anchorPrice)
    if (pd !== 0 && ad !== 0) {
      hits.push(pd === ad ? 1 : 0)
    }
  }

  const nDirectional = hits.length
  const nCorrect = hits.reduce((a, b) => a + b, 0)
  const hitRate = nDirectional >= 5 ? nCorrect / nDirectional : null
  const sePp = nDirectional >= 5 ? +(Math.sqrt(0.25 / nDirectional) * 100).toFixed(2) : NaN
  const z =
    hitRate !== null && nDirectional >= 5
      ? +(((hitRate - 0.5) / Math.sqrt(0.25 / nDirectional))).toFixed(2)
      : 0
  const pValue = hitRate !== null ? +twoSidedPValue(z).toFixed(4) : 1
  const halfWidth = nDirectional >= 5 ? 1.959964 * Math.sqrt(0.25 / nDirectional) : 0

  return {
    mae: errs.length ? errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length : NaN,
    rmse: errs.length ? Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length) : NaN,
    hitRate,
    nTest: errs.length,
    nDirectional,
    nCorrect,
    sePp,
    z,
    pValue,
    ci95:
      hitRate !== null
        ? [Math.max(0, +(hitRate - halfWidth).toFixed(4)), Math.min(1, +(hitRate + halfWidth).toFixed(4))]
        : null,
  }
}

/* ── Interval Calibration, Kupiec POF, Christoffersen & QLIKE ─── */

export interface KupiecResult {
  /** Number of forecasts tested. */
  n: number
  /** Number of interval violations (actual outside [lo, hi]). */
  failures: number
  /** Expected failure rate alpha = 1 - targetCoverage. */
  expectedFailureRate: number
  /** Observed failure rate failures / n. */
  observedFailureRate: number
  /** Likelihood-ratio statistic LR_POF ~ Chi²(1) under H0. */
  lrPof: number
  /** p-value for H0: empirical coverage equals nominal coverage. */
  pValue: number
  /** True when H0 is rejected at 5% significance (lrPof > 3.8415). */
  rejectedAt95: boolean
}

/**
 * Kupiec (1995) Proportion of Failures (POF) unconditional coverage test.
 * Tests whether the empirical violation frequency matches nominal alpha = 1 - targetCoverage.
 */
export function kupiecPofTest(n: number, failures: number, targetCoverage = 0.95): KupiecResult {
  const alpha = 1 - targetCoverage
  if (n <= 0) {
    return {
      n: 0,
      failures: 0,
      expectedFailureRate: alpha,
      observedFailureRate: 0,
      lrPof: 0,
      pValue: 1,
      rejectedAt95: false,
    }
  }
  const x = Math.max(0, Math.min(n, failures))
  const piHat = x / n

  const safeLogLikelihood = (p: number) => {
    const pc = Math.max(1e-12, Math.min(1 - 1e-12, p))
    return (n - x) * Math.log(1 - pc) + x * Math.log(pc)
  }

  const llNull = safeLogLikelihood(alpha)
  const llAlt = safeLogLikelihood(piHat)
  const lrPof = Math.max(0, -2 * (llNull - llAlt))
  const pValue = chiSquarePValue(lrPof, 1)

  return {
    n,
    failures: x,
    expectedFailureRate: +alpha.toFixed(4),
    observedFailureRate: +piHat.toFixed(4),
    lrPof: +lrPof.toFixed(4),
    pValue: +pValue.toFixed(4),
    rejectedAt95: lrPof > 3.841459,
  }
}

export interface ChristoffersenResult {
  /** Independence likelihood-ratio statistic LR_ind ~ Chi²(1). */
  lrInd: number
  /** Conditional coverage statistic LR_cc = LR_pof + LR_ind ~ Chi²(2). */
  lrCc: number
  pValueInd: number
  pValueCc: number
  /** Transition counts [n00, n01, n10, n11]. */
  transitions: [number, number, number, number]
}

/**
 * Christoffersen (1998) Markov independence and conditional coverage test.
 * Detects whether interval violations cluster in time rather than occurring independently.
 */
export function christoffersenTest(
  violations: (0 | 1)[],
  targetCoverage = 0.95
): ChristoffersenResult {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0
  for (let i = 1; i < violations.length; i++) {
    const prev = violations[i - 1]
    const curr = violations[i]
    if (prev === 0 && curr === 0) n00++
    else if (prev === 0 && curr === 1) n01++
    else if (prev === 1 && curr === 0) n10++
    else n11++
  }

  const totalTrans = n00 + n01 + n10 + n11
  if (totalTrans === 0) {
    return { lrInd: 0, lrCc: 0, pValueInd: 1, pValueCc: 1, transitions: [0, 0, 0, 0] }
  }

  const pi0 = n00 + n01 > 0 ? n01 / (n00 + n01) : 0
  const pi1 = n10 + n11 > 0 ? n11 / (n10 + n11) : 0
  const pi = (n01 + n11) / totalTrans

  const term = (c0: number, c1: number, p: number) => {
    if (c0 + c1 === 0) return 0
    const pc = Math.max(1e-12, Math.min(1 - 1e-12, p))
    return c0 * Math.log(1 - pc) + c1 * Math.log(pc)
  }

  const llNull = term(n00 + n10, n01 + n11, pi)
  const llAlt = term(n00, n01, pi0) + term(n10, n11, pi1)
  const lrInd = Math.max(0, -2 * (llNull - llAlt))

  const failures = violations.reduce<number>((a, b) => a + b, 0)
  const pof = kupiecPofTest(violations.length, failures, targetCoverage)
  const lrCc = pof.lrPof + lrInd

  return {
    lrInd: +lrInd.toFixed(4),
    lrCc: +lrCc.toFixed(4),
    pValueInd: +chiSquarePValue(lrInd, 1).toFixed(4),
    pValueCc: +chiSquarePValue(lrCc, 2).toFixed(4),
    transitions: [n00, n01, n10, n11],
  }
}

/**
 * Patton (2011) QLIKE volatility loss: log(sigma2_hat) + r^2 / sigma2_hat.
 * Robust proper loss function for comparing conditional variance forecasts
 * against realised squared returns.
 */
export function qlikeLoss(forecastVariance: number[], realisedSquaredReturn: number[]): number {
  const n = Math.min(forecastVariance.length, realisedSquaredReturn.length)
  if (n === 0) return NaN
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const s2 = Math.max(forecastVariance[i], 1e-12)
    const r2 = Math.max(realisedSquaredReturn[i], 0)
    if (!Number.isFinite(s2) || !Number.isFinite(r2)) continue
    sum += Math.log(s2) + r2 / s2
    count++
  }
  return count > 0 ? sum / count : NaN
}

/**
 * Winkler (1972) proper interval score (normalised as % of anchor price).
 * Penalises wide bands, and heavily penalises observations that fall outside [lo, hi]
 * by (2 / alpha) * distance_outside. Lower is better.
 */
export function winklerIntervalScorePct(
  lo: number,
  hi: number,
  actual: number,
  anchorPrice: number,
  alpha = 0.05
): number {
  const scale = Math.max(anchorPrice, 1e-8)
  const width = Math.max(0, hi - lo)
  let penalty = 0
  if (actual < lo) penalty = (2 / alpha) * (lo - actual)
  else if (actual > hi) penalty = (2 / alpha) * (actual - hi)
  return ((width + penalty) / scale) * 100
}

export interface IntervalEvaluationSummary {
  tests: number
  covered: number
  coverage: number
  targetCoverage: number
  meanWidthPct: number
  meanWinklerScorePct: number
  qlike: number
  kupiec: KupiecResult
  christoffersen: ChristoffersenResult
}

/**
 * Walk-forward out-of-sample interval calibration harness.
 *
 * At each step `i`, calls `bandBuilder(prices.slice(0, i + 1))` to produce a
 * `horizon`-step-ahead interval `{ lo, hi, variance }` and checks whether
 * `prices[i + horizon]` lands inside `[lo, hi]`.
 */
export function evaluateIntervalCoverage(
  prices: number[],
  bandBuilder: (trainPrices: number[], horizon: number) => {
    lo: number
    hi: number
    variance?: number
  } | null,
  opts: {
    steps?: number
    horizon?: number
    minWarmup?: number
    targetCoverage?: number
  } = {}
): IntervalEvaluationSummary {
  const steps = opts.steps ?? 200
  const horizon = Math.max(1, opts.horizon ?? 5)
  const minWarmup = Math.max(50, opts.minWarmup ?? 60)
  const targetCoverage = opts.targetCoverage ?? 0.95
  const alpha = 1 - targetCoverage

  const maxSteps = prices.length - minWarmup - horizon
  const usable = Math.min(steps, maxSteps)
  if (usable <= 0) {
    return {
      tests: 0,
      covered: 0,
      coverage: NaN,
      targetCoverage,
      meanWidthPct: NaN,
      meanWinklerScorePct: NaN,
      qlike: NaN,
      kupiec: kupiecPofTest(0, 0, targetCoverage),
      christoffersen: christoffersenTest([], targetCoverage),
    }
  }

  const startIdx = prices.length - horizon - usable
  let covered = 0
  const widthsPct: number[] = []
  const winklerScores: number[] = []
  const violations: (0 | 1)[] = []
  const fcVars: number[] = []
  const realisedVars: number[] = []

  for (let s = 0; s < usable; s++) {
    const anchorIdx = startIdx + s
    const train = prices.slice(0, anchorIdx + 1)
    const anchorPrice = train[train.length - 1]
    const actual = prices[anchorIdx + horizon]

    const band = bandBuilder(train, horizon)
    if (!band || !Number.isFinite(band.lo) || !Number.isFinite(band.hi)) continue

    const isInside = actual >= band.lo && actual <= band.hi
    if (isInside) covered++
    violations.push(isInside ? 0 : 1)

    widthsPct.push(((band.hi - band.lo) / anchorPrice) * 100)
    winklerScores.push(winklerIntervalScorePct(band.lo, band.hi, actual, anchorPrice, alpha))

    if (band.variance !== undefined && Number.isFinite(band.variance)) {
      fcVars.push(band.variance)
      const cumLogRet = Math.log(actual / anchorPrice)
      realisedVars.push(cumLogRet * cumLogRet)
    }
  }

  const tests = violations.length
  const failures = tests - covered
  const coverage = tests > 0 ? +(covered / tests).toFixed(4) : NaN
  const meanWidthPct =
    widthsPct.length > 0
      ? +(widthsPct.reduce((a, b) => a + b, 0) / widthsPct.length).toFixed(2)
      : NaN
  const meanWinklerScorePct =
    winklerScores.length > 0
      ? +(winklerScores.reduce((a, b) => a + b, 0) / winklerScores.length).toFixed(2)
      : NaN

  return {
    tests,
    covered,
    coverage,
    targetCoverage,
    meanWidthPct,
    meanWinklerScorePct,
    qlike: +qlikeLoss(fcVars, realisedVars).toFixed(4),
    kupiec: kupiecPofTest(tests, failures, targetCoverage),
    christoffersen: christoffersenTest(violations, targetCoverage),
  }
}
