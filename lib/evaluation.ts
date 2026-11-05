/**
 * Offline evaluation results — the product's identity, in one place.
 *
 * Every number here is copied from docs/FORECAST-EVALUATION.md, which records
 * how it was measured and how to re-run it. Nothing in this file is computed
 * at request time, and nothing may be added here that is not in that doc.
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
