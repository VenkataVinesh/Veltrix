import { describe, expect, it } from 'vitest'
import {
  FEATURE_WARMUP,
  buildDataset,
  latestFeatures,
  ridgeFit,
  ridgePredict,
  gbFit,
  gbPredict,
  garchFit,
  garchPath,
} from '@/lib/market/ml'

function syntheticPrices(n: number, seed = 11) {
  let s = seed
  let p = 100
  const prices: number[] = []
  const vols: number[] = []
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    const r = (s / 2 ** 32 - 0.5) * 0.03
    p = p * Math.exp(r)
    prices.push(p)
    vols.push(1000 + ((s >>> 8) % 500))
  }
  return { prices, vols }
}

describe('feature engineering (lib/market/ml.ts)', () => {
  it('requires at least FEATURE_WARMUP + 2 bars to build training rows', () => {
    const { prices, vols } = syntheticPrices(FEATURE_WARMUP)
    expect(buildDataset(prices, vols).X).toHaveLength(0)
    expect(latestFeatures(prices, vols)).toBeNull()
  })

  it('produces 11 finite features per row and degrades gracefully when volume is zero', () => {
    const { prices } = syntheticPrices(90)
    const zeroVols = new Array(90).fill(0)
    const { X, y } = buildDataset(prices, zeroVols)
    expect(X.length).toBe(90 - FEATURE_WARMUP - 1)
    expect(y.length).toBe(X.length)
    for (const row of X) {
      expect(row).toHaveLength(11)
      expect(row.every((v) => Number.isFinite(v))).toBe(true)
      // Volume surprise feature is tanh(1 - 1) = 0 when volume is absent
      expect(row[10]).toBe(0)
    }
  })

  it('is strictly backward-looking: mutating future bars never changes earlier feature rows', () => {
    const { prices, vols } = syntheticPrices(80)
    const ds1 = buildDataset(prices, vols)

    const mutatedPrices = [...prices]
    const mutatedVols = [...vols]
    mutatedPrices[79] = 999_999
    mutatedVols[79] = 999_999_999

    const ds2 = buildDataset(mutatedPrices, mutatedVols)
    // All feature rows except the target y of the penultimate bar (which predicts index 79) must be identical
    expect(ds2.X.slice(0, -1)).toEqual(ds1.X.slice(0, -1))
    expect(ds2.y.slice(0, -1)).toEqual(ds1.y.slice(0, -1))
  })
})

describe('Ridge regression', () => {
  it('returns null when rows are fewer than d + 10', () => {
    const X = Array.from({ length: 12 }, (_, i) => [i, i * 2, i * 3])
    const y = X.map((r) => r[0])
    expect(ridgeFit(X, y)).toBeNull()
  })

  it('recovers a linear signal and shrinks weights monotonically as L2 penalty lambda increases', () => {
    const X: number[][] = []
    const y: number[] = []
    let s = 5
    for (let i = 0; i < 80; i++) {
      s = (s * 1664525 + 1013904223) % 2 ** 32
      const x1 = (s / 2 ** 32 - 0.5) * 2
      s = (s * 1664525 + 1013904223) % 2 ** 32
      const x2 = (s / 2 ** 32 - 0.5) * 2
      X.push([x1, x2])
      y.push(0.5 * x1 - 0.25 * x2 + 0.05)
    }

    const lowReg = ridgeFit(X, y, 0.01)!
    const highReg = ridgeFit(X, y, 100)!
    expect(lowReg).not.toBeNull()
    expect(highReg).not.toBeNull()

    const normLow = Math.hypot(...lowReg.w)
    const normHigh = Math.hypot(...highReg.w)
    expect(normHigh).toBeLessThan(normLow)

    const pred = ridgePredict(lowReg, [1, -1])
    expect(pred).toBeCloseTo(0.5 * 1 - 0.25 * -1 + 0.05, 1)
  })
})

describe('Gradient-boosted stumps', () => {
  it('returns null for fewer than 40 samples and reduces training MSE on a nonlinear step target', () => {
    expect(gbFit([[1, 2]], [1])).toBeNull()

    const X: number[][] = []
    const y: number[] = []
    for (let i = 0; i < 60; i++) {
      const x0 = (i - 30) / 10
      const x1 = ((i * 7) % 13) - 6
      X.push([x0, x1])
      y.push(x0 > 0 ? 0.04 : -0.04)
    }

    const model = gbFit(X, y, 30, 0.15)!
    expect(model).not.toBeNull()
    expect(model.trees.length).toBeGreaterThan(0)
    expect(gbPredict(model, [2, 0])).toBeGreaterThan(0.02)
    expect(gbPredict(model, [-2, 0])).toBeLessThan(-0.02)
  })
})

describe('GARCH(1,1) volatility model', () => {
  it('refuses short or degenerate return series', () => {
    expect(garchFit([0.01, -0.01])).toBeNull()
    expect(garchFit(new Array(60).fill(0))).toBeNull()
  })

  it('enforces stationarity (alpha + beta < 1) and mean-reverts multi-step variance toward unconditional variance', () => {
    // Generate a clustered volatility return series
    let s = 23
    const r: number[] = []
    let sigma = 0.015
    for (let i = 0; i < 250; i++) {
      s = (s * 1664525 + 1013904223) % 2 ** 32
      const z = (s / 2 ** 32 - 0.5) * 3.464 // unit variance uniform
      const ret = sigma * z
      r.push(ret)
      sigma = Math.sqrt(0.00002 + 0.14 * ret * ret + 0.8 * sigma * sigma)
    }
    // Spike the final return to create a high-volatility regime at the end of the sample
    r.push(0.08)

    const fit = garchFit(r)!
    expect(fit).not.toBeNull()
    expect(fit.alpha + fit.beta).toBeLessThan(1)
    expect(fit.omega).toBeGreaterThan(0)

    const path = garchPath(fit, 30)
    expect(path.step).toHaveLength(30)
    expect(path.cumulative).toHaveLength(30)

    // Because the last return was a huge shock (0.08), conditional step volatility starts above
    // the unconditional level and decays monotonically toward it.
    const uncondSigma = Math.sqrt(fit.omega / (1 - fit.alpha - fit.beta))
    expect(path.step[0]).toBeGreaterThan(uncondSigma)
    expect(path.step[29]).toBeLessThan(path.step[0])
    expect(Math.abs(path.step[29] - uncondSigma)).toBeLessThan(Math.abs(path.step[0] - uncondSigma))
  })
})
