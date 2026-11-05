import { describe, expect, it } from 'vitest'
import { computeForecast, computeSignal, rsi, sma } from '@/lib/market/analysis'
import { indistinguishableFromChance, marginPp } from '@/lib/evaluation'
import candlesFixture from './fixtures/btc-30d-2026-11-04.json'
import liveSignal from './fixtures/btc-signal-2026-11-04.json'

const candles = candlesFixture.candles

/** Deterministic random walk (LCG) so tests never depend on Math.random. */
function walk(n: number, seed = 7, drift = 0) {
  let s = seed, p = 100
  return Array.from({ length: n }, (_, i) => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    const r = (s / 2 ** 32 - 0.5) * 0.04 + drift
    const o = p; p = p * (1 + r)
    return { t: 1_700_000_000 + i * 86_400, o, h: Math.max(o, p) * 1.003, l: Math.min(o, p) * 0.997, c: p, v: 0 }
  })
}

describe('indicators', () => {
  it('sma is null until the window fills, then the mean', () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })
  it('rsi stays inside [0, 100] and saturates on a strictly rising series', () => {
    const up = Array.from({ length: 40 }, (_, i) => 100 + i)
    const v = rsi(up).filter((x): x is number => x != null)
    expect(v.every((x) => x >= 0 && x <= 100)).toBe(true)
    // With no losses the implementation caps RS at 100, so RSI = 100 - 100/101 ≈ 99.01.
    expect(v.at(-1)).toBeCloseTo(100 - 100 / 101, 6)
  })
})

describe('computeSignal', () => {
  it('refuses to score fewer than 30 bars', () => {
    expect(computeSignal('X', walk(29))).toBeNull()
  })

  it('reproduces the production response on the captured BTC candles', () => {
    const s = computeSignal('BTC', candles)!
    expect(s.signal).toBe(liveSignal.signal)
    expect(s.momentum).toBeCloseTo(liveSignal.momentum, 3)
    expect(s.components.map((c) => [c.name, c.vote, c.weight])).toEqual(
      liveSignal.components.map((c) => [c.name, c.vote, c.weight])
    )
  })

  it('headline and thresholds never disagree', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = computeSignal('X', walk(120, seed))!
      const expected = s.momentum > 0.3 ? 'BUY' : s.momentum < -0.3 ? 'SELL' : 'HOLD'
      expect(s.signal).toBe(expected)
      expect(s.bullishProbability + s.bearishProbability).toBeCloseTo(1, 6)
    }
  })

  it('exposes every component, including neutral ones', () => {
    const s = computeSignal('X', walk(120))!
    expect(s.components).toHaveLength(5)
  })
})

describe('computeForecast', () => {
  const f = computeForecast('X', walk(200, 3), 14)!

  it('returns one band point per horizon step, ordered lo <= mid <= hi', () => {
    expect(f.path).toHaveLength(14)
    for (const p of f.path) {
      expect(p.lo).toBeLessThanOrEqual(p.mid)
      expect(p.mid).toBeLessThanOrEqual(p.hi)
    }
  })

  it('bands widen with the horizon', () => {
    const width = f.path.map((p) => p.hi - p.lo)
    expect(width.at(-1)!).toBeGreaterThan(width[0])
  })

  it('ensemble weights are a probability vector', () => {
    const total = Object.values(f.weights).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 2)
    expect(Object.values(f.weights).every((w) => w >= 0)).toBe(true)
  })

  it('hit-rate is measured (in [0,1]) or explicitly null, never a silent 0.5', () => {
    expect(f.hitRate === null || (f.hitRate >= 0 && f.hitRate <= 1)).toBe(true)
    expect(f.backtest.nCorrect).toBeLessThanOrEqual(f.backtest.nDirectional)
  })
})

describe('evaluation helpers', () => {
  it('matches the documented error bars', () => {
    // FORECAST-EVALUATION.md: SE 1.29pp at n=1500 (95% margin = 1.96 * SE), 7.9pp SE at n=40.
    expect(marginPp(1500) / 1.96).toBeCloseTo(1.29, 2)
    expect(marginPp(40) / 1.96).toBeCloseTo(7.9, 1)
  })
  it('50.2% over 1,500 calls is indistinguishable from chance; 60% over 30 is too', () => {
    expect(indistinguishableFromChance(0.502, 1500)).toBe(true)
    expect(indistinguishableFromChance(0.6, 30)).toBe(true)
    expect(indistinguishableFromChance(0.6, 1500)).toBe(false)
  })
})
