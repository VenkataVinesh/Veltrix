import { describe, expect, it } from 'vitest'
import {
  CALIBRATION,
  DIRECTION,
  christoffersenTest,
  evaluateIntervalCoverage,
  evaluateWalkForward,
  holmBonferroni,
  indistinguishableFromChance,
  kupiecPofTest,
  marginPp,
  qlikeLoss,
  sidakAlpha,
  winklerIntervalScorePct,
} from '@/lib/evaluation'
import { computeForecast, BASELINE_MODELS, ALL_MODELS } from '@/lib/market/analysis'
import { garchFit, garchPath } from '@/lib/market/ml'

/** Deterministic LCG random walk so tests never depend on Math.random. */
function makeSeries(n: number, seed = 42, vol = 0.02) {
  let s = seed
  let p = 100
  const prices: number[] = []
  const candles: { t: number; o: number; h: number; l: number; c: number; v: number }[] = []
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    const u = s / 2 ** 32 - 0.5
    const o = p
    p = p * Math.exp(u * vol * 2)
    prices.push(p)
    candles.push({
      t: 1_700_000_000 + i * 86_400,
      o,
      h: Math.max(o, p) * 1.004,
      l: Math.min(o, p) * 0.996,
      c: p,
      v: 1000 + (i % 7) * 150,
    })
  }
  return { prices, candles }
}

describe('evaluation referee — anti-lookahead guarantees', () => {
  it('cannot see future bars: a series whose future steps are unpredictable yields ~50% (no edge)', () => {
    const { prices, candles } = makeSeries(320, 101)
    const fc = computeForecast('SYN', candles, 14, { steps: 200, allow: BASELINE_MODELS })!
    expect(fc).not.toBeNull()
    expect(fc.backtest.nDirectional).toBeGreaterThan(150)
    expect(indistinguishableFromChance(fc.backtest.hitRate!, fc.backtest.nDirectional)).toBe(true)

    // Direct referee check on an AR/drift predictor: cannot see prices[i] at step i
    const summary = evaluateWalkForward(
      prices,
      (train) => {
        const last = train[train.length - 1]
        const prev = train[train.length - 2] ?? last
        return last * (1 + 0.1 * Math.log(last / prev))
      },
      [],
      { steps: 200 }
    )
    expect(summary.hitRate).not.toBeNull()
    expect(indistinguishableFromChance(summary.hitRate!, summary.nDirectional)).toBe(true)
  })

  it('catches a deliberately introduced 1-bar lookahead leak immediately', () => {
    const { prices } = makeSeries(260, 77)

    // Honest predictor: uses only the slice passed by the referee
    const honest = evaluateWalkForward(
      prices,
      (train) => {
        const last = train[train.length - 1]
        const prev = train[train.length - 2] ?? last
        return last + 0.05 * (last - prev)
      },
      [],
      { steps: 180 }
    )

    // Deliberately leaked predictor: closes over the outer `prices` array and peeks at `prices[train.length]`
    const leaked = evaluateWalkForward(
      prices,
      (train) => {
        const nextActual = prices[train.length] // <-- illegal lookahead into test bar!
        return nextActual
      },
      [],
      { steps: 180 }
    )

    // The honest predictor has no edge; the leaked predictor achieves 100% and z > 10.
    expect(indistinguishableFromChance(honest.hitRate!, honest.nDirectional)).toBe(true)
    expect(leaked.hitRate).toBe(1)
    expect(leaked.rmse).toBeCloseTo(0, 8)
    expect(indistinguishableFromChance(leaked.hitRate!, leaked.nDirectional)).toBe(false)
    expect(leaked.z).toBeGreaterThan(10)
  })

  it('enforces strict prefix invariance: corrupting future bars never alters historical predictions', () => {
    const { prices } = makeSeries(180, 19)
    const stepOutputsOriginal: number[] = []
    const stepOutputsCorrupted: number[] = []

    evaluateWalkForward(
      prices,
      (train) => {
        // Check that train never contains any bar beyond its own length
        const pred = train[train.length - 1] * (1 + (train[train.length - 1] - train[0]) / train[0] * 0.01)
        stepOutputsOriginal.push(pred)
        return pred
      },
      [],
      { steps: 50 }
    )

    // Mutate the last bar to 1,000,000,000; every prior step 0..48 must receive identical training slices
    const corrupted = [...prices]
    corrupted[corrupted.length - 1] = 1_000_000_000

    evaluateWalkForward(
      corrupted,
      (train) => {
        const pred = train[train.length - 1] * (1 + (train[train.length - 1] - train[0]) / train[0] * 0.01)
        stepOutputsCorrupted.push(pred)
        return pred
      },
      [],
      { steps: 50 }
    )

    expect(stepOutputsCorrupted).toEqual(stepOutputsOriginal)
  })

  it('purges overlapping training bars when embargoBars > 0 or horizon > 1', () => {
    const { prices } = makeSeries(120, 55)
    const seenLengths: number[] = []

    evaluateWalkForward(
      prices,
      (train) => {
        seenLengths.push(train.length)
        return train[train.length - 1] * 1.001
      },
      [],
      { steps: 20, horizon: 5, embargoBars: 4 }
    )

    // With 120 bars, horizon=5, steps=20: last anchor is index 114 (predicting 119).
    // With embargoBars=4, trainEnd at the last step is 114 + 1 - 4 = 111.
    expect(seenLengths.at(-1)).toBe(111)
    expect(seenLengths).toHaveLength(20)
  })

  it('excludes flat predictions from nDirectional so a random-walk baseline reports null, not 0.5', () => {
    const { prices, candles } = makeSeries(150, 9)
    const naiveSummary = evaluateWalkForward(prices, (train) => train[train.length - 1], [], { steps: 60 })
    expect(naiveSummary.nTest).toBe(60)
    expect(naiveSummary.nDirectional).toBe(0)
    expect(naiveSummary.hitRate).toBeNull()

    const fcNaiveOnly = computeForecast('SYN', candles, 14, { allow: ['naive'], steps: 60 })!
    expect(fcNaiveOnly.backtest.nDirectional).toBe(0)
    expect(fcNaiveOnly.hitRate).toBeNull()
  })
})

describe('statistical & calibration tests (Kupiec, Christoffersen, Winkler, QLIKE, Holm-Bonferroni)', () => {
  it('matches the documented error bars and pooled z-score', () => {
    expect(marginPp(1500) / 1.96).toBeCloseTo(DIRECTION.sePp, 2)
    expect(marginPp(40) / 1.96).toBeCloseTo(7.9, 1)
    expect(indistinguishableFromChance(DIRECTION.hitRate, DIRECTION.calls)).toBe(true)
    expect(indistinguishableFromChance(0.6, 30)).toBe(true)
    expect(indistinguishableFromChance(0.6, 1500)).toBe(false)
  })

  it('Kupiec POF test formally passes GARCH (94.75% / 1200) and rejects EWMA (91.67% / 1200)', () => {
    const garchFailures = Math.round(CALIBRATION.tests * (1 - CALIBRATION.garch.coverage)) // 63 / 1200
    const ewmaFailures = Math.round(CALIBRATION.tests * (1 - CALIBRATION.ewma.coverage)) // 100 / 1200

    const garchTest = kupiecPofTest(CALIBRATION.tests, garchFailures, 0.95)
    const ewmaTest = kupiecPofTest(CALIBRATION.tests, ewmaFailures, 0.95)

    // GARCH(1,1): 63 failures vs 60 expected -> LR_POF ≈ 0.156, p ≈ 0.69 -> calibrated (not rejected)
    expect(garchTest.rejectedAt95).toBe(false)
    expect(garchTest.pValue).toBeGreaterThan(0.5)

    // EWMA: 100 failures vs 60 expected -> LR_POF ≈ 24.9, p < 0.0001 -> overconfident (rejected)
    expect(ewmaTest.rejectedAt95).toBe(true)
    expect(ewmaTest.lrPof).toBeGreaterThan(20)
    expect(ewmaTest.pValue).toBeLessThan(0.001)
  })

  it('Christoffersen independence test detects clustered violations vs independent ones', () => {
    // Clustered: 10 consecutive violations then 190 non-violations
    const clustered: (0 | 1)[] = [
      ...new Array(10).fill(1),
      ...new Array(190).fill(0),
    ]
    // Spread out: 1 violation every 20 steps
    const spread: (0 | 1)[] = Array.from({ length: 200 }, (_, i) => (i % 20 === 0 ? 1 : 0))

    const cCluster = christoffersenTest(clustered, 0.95)
    const cSpread = christoffersenTest(spread, 0.95)

    expect(cCluster.lrInd).toBeGreaterThan(30)
    expect(cCluster.pValueInd).toBeLessThan(0.001)
    expect(cSpread.lrInd).toBeLessThan(3.84)
    expect(cSpread.pValueInd).toBeGreaterThan(0.05)
  })

  it('Winkler interval score penalises out-of-band misses proportionally to 2/alpha', () => {
    const inside = winklerIntervalScorePct(95, 105, 100, 100, 0.05)
    const missedBy2 = winklerIntervalScorePct(95, 105, 107, 100, 0.05)
    expect(inside).toBeCloseTo(10, 5)
    // Missed by 2 above 105 with alpha=0.05 adds (2 / 0.05) * 2 = 80 -> total 90%
    expect(missedBy2).toBeCloseTo(90, 5)
  })

  it('QLIKE loss is minimised when forecast variance matches true variance', () => {
    const realized = Array.from({ length: 100 }, () => 0.0004)
    const exact = qlikeLoss(new Array(100).fill(0.0004), realized)
    const under = qlikeLoss(new Array(100).fill(0.0001), realized)
    const over = qlikeLoss(new Array(100).fill(0.0016), realized)
    expect(exact).toBeLessThan(under)
    expect(exact).toBeLessThan(over)
  })

  it('Holm-Bonferroni and Šidák adjustments control family-wise error rate', () => {
    const raw = [0.01, 0.04, 0.2]
    const adj = holmBonferroni(raw)
    // m=3: sorted [0.01*3=0.03, max(0.03, 0.04*2)=0.08, max(0.08, 0.2*1)=0.2]
    expect(adj[0]).toBeCloseTo(0.03, 5)
    expect(adj[1]).toBeCloseTo(0.08, 5)
    expect(adj[2]).toBeCloseTo(0.2, 5)
    expect(sidakAlpha(0.05, 5)).toBeLessThan(0.0103)
  })

  it('evaluateIntervalCoverage runs walk-forward 5-day band evaluation with GARCH(1,1)', () => {
    const { prices } = makeSeries(220, 33, 0.015)
    const res = evaluateIntervalCoverage(
      prices,
      (train, horizon) => {
        const r = train.slice(1).map((x, i) => Math.log(x / train[i]))
        const g = garchFit(r)
        if (!g) return null
        const cumSigma = garchPath(g, horizon).cumulative[horizon - 1]
        const half = 1.959964 * cumSigma
        const last = train[train.length - 1]
        return { lo: last * Math.exp(-half), hi: last * Math.exp(half), variance: cumSigma ** 2 }
      },
      { steps: 80, horizon: 5 }
    )
    expect(res.tests).toBe(80)
    expect(res.coverage).toBeGreaterThan(0.8)
    expect(res.meanWidthPct).toBeGreaterThan(0)
    expect(Number.isFinite(res.qlike)).toBe(true)
  })

  it('retains learned models via allow: ALL_MODELS for reproducible benchmarking', () => {
    const { candles } = makeSeries(140, 12)
    const fc = computeForecast('SYN', candles, 5, { allow: ALL_MODELS, steps: 15 })!
    expect(fc).not.toBeNull()
    expect(Object.keys(fc.weights)).toEqual(expect.arrayContaining(['drift_ewma', 'ar', 'naive', 'ridge', 'gbm']))
  })
})
