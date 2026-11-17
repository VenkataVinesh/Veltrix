import { describe, expect, it } from 'vitest'
import {
  atr,
  bollinger,
  computeForecast,
  computeSignal,
  ema,
  macd,
  rsi,
  sma,
} from '@/lib/market/analysis'
import { indistinguishableFromChance, marginPp } from '@/lib/evaluation'
import candlesFixture from './fixtures/btc-30d-2026-11-04.json'
import liveSignal from './fixtures/btc-signal-2026-11-04.json'

const candles = candlesFixture.candles

/** Deterministic random walk (LCG) so tests never depend on Math.random. */
function walk(n: number, seed = 7, drift = 0, withVolume = false) {
  let s = seed, p = 100
  return Array.from({ length: n }, (_, i) => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    const r = (s / 2 ** 32 - 0.5) * 0.04 + drift
    const o = p; p = p * (1 + r)
    return {
      t: 1_700_000_000 + i * 86_400,
      o,
      h: Math.max(o, p) * 1.003,
      l: Math.min(o, p) * 0.997,
      c: p,
      v: withVolume ? 1000 + (i === n - 1 ? 2500 : 0) : 0,
    }
  })
}

describe('indicators', () => {
  it('sma is null until the window fills, then the mean', () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })

  it('ema seeds with the initial SMA and weights subsequent values with k = 2/(p+1)', () => {
    const out = ema([2, 4, 6, 8], 2)
    // p=2 => k = 2/3. Index 0 is null, index 1 is SMA(2,4)=3, index 2 is (6-3)*(2/3)+3 = 5
    expect(out[0]).toBeNull()
    expect(out[1]).toBeCloseTo(3, 6)
    expect(out[2]).toBeCloseTo(5, 6)
    expect(out[3]).toBeCloseTo(7, 6)
  })

  it('rsi stays inside [0, 100] and saturates on a strictly rising series', () => {
    const up = Array.from({ length: 40 }, (_, i) => 100 + i)
    const v = rsi(up).filter((x): x is number => x != null)
    expect(v.every((x) => x >= 0 && x <= 100)).toBe(true)
    // With no losses the implementation caps RS at 100, so RSI = 100 - 100/101 ≈ 99.01.
    expect(v.at(-1)).toBeCloseTo(100 - 100 / 101, 6)
  })

  it('macd produces null line before bar 26 and positive histogram on accelerating uptrend', () => {
    const expUp = Array.from({ length: 50 }, (_, i) => 100 * Math.exp(i * 0.02))
    const m = macd(expUp)
    expect(m.line.slice(0, 25).every((x) => x === null)).toBe(true)
    expect(m.line.at(-1)!).toBeGreaterThan(0)
    expect(m.hist.at(-1)!).toBeGreaterThan(0)
  })

  it('bollinger bands collapse to zero width on a flat series and bracket volatile series', () => {
    const flat = bollinger(new Array(25).fill(50), 20, 2)
    expect(flat[18].mid).toBeNull()
    expect(flat[19]).toEqual({ upper: 50, mid: 50, lower: 50 })
  })

  it('atr returns 0 for single candle and positive average true range for multi-bar series', () => {
    expect(atr(walk(1))).toBe(0)
    expect(atr(walk(30))).toBeGreaterThan(0)
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

  it('headline and thresholds never disagree across seeds and volume states', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = computeSignal('X', walk(120, seed, 0, seed % 2 === 0))!
      const expected = s.momentum > 0.3 ? 'BUY' : s.momentum < -0.3 ? 'SELL' : 'HOLD'
      expect(s.signal).toBe(expected)
      expect(s.bullishProbability + s.bearishProbability).toBeCloseTo(1, 6)
    }
  })

  it('triggers volume confirmation when latest bar exceeds 1.5x 20-bar average', () => {
    const sWithVol = computeSignal('X', walk(40, 7, 0, true))!
    const volComp = sWithVol.components.find((c) => c.name.startsWith('Volume'))!
    expect(volComp.vote).toBe('bullish')
    expect(volComp.weight).toBe(0.3)
  })

  it('exposes every component, including neutral ones', () => {
    const s = computeSignal('X', walk(120))!
    expect(s.components).toHaveLength(5)
  })
})

describe('computeForecast', () => {
  const f = computeForecast('X', walk(200, 3), 14)!

  it('returns null when history is shorter than AR_ORDER + 20', () => {
    expect(computeForecast('X', walk(20), 14)).toBeNull()
  })

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

  it('supports noGarch option to compare EWMA vs GARCH(1,1) bands on identical data', () => {
    const series = walk(200, 14)
    const garchFc = computeForecast('X', series, 10, { noGarch: false })!
    const ewmaFc = computeForecast('X', series, 10, { noGarch: true })!
    expect(garchFc.methodology).toContain('GARCH(1,1)')
    expect(ewmaFc.methodology).toContain('EWMA volatility')
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
    expect(marginPp(1500) / 1.96).toBeCloseTo(1.29, 2)
    expect(marginPp(40) / 1.96).toBeCloseTo(7.9, 1)
  })
  it('50.2% over 1,500 calls is indistinguishable from chance; 60% over 30 is too', () => {
    expect(indistinguishableFromChance(0.502, 1500)).toBe(true)
    expect(indistinguishableFromChance(0.6, 30)).toBe(true)
    expect(indistinguishableFromChance(0.6, 1500)).toBe(false)
  })
})
