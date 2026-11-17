import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as getQuotesRoute } from '@/app/api/quotes/route'
import { GET as getCandlesRoute } from '@/app/api/candles/route'
import { GET as getSignalRoute } from '@/app/api/signal/route'
import { GET as getForecastRoute } from '@/app/api/forecast/route'
import { GET as getMacroRoute } from '@/app/api/macro/route'
import { GET as getAgentsRoute } from '@/app/api/agents/route'
import candlesFixture from './fixtures/btc-30d-2026-11-04.json'
import liveSignal from './fixtures/btc-signal-2026-11-04.json'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('API route resilience & honest unavailability', () => {
  it('/api/candles returns unavailable:true for equities when TWELVEDATA_API_KEY is unset, never fake bars', async () => {
    const req = new Request('http://localhost:3000/api/candles?symbol=AAPL&days=90')
    const res = await getCandlesRoute(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unavailable).toBe(true)
    expect(body.candles).toEqual([])
    expect(body.reason).toContain('TWELVEDATA_API_KEY')
  })

  it('/api/signal returns unavailable:true when upstream returns fewer than 30 bars', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([[1700000000000, 100, 105, 95, 102]]), { status: 200 })
    )
    const req = new Request('http://localhost:3000/api/signal?symbol=BTC')
    const res = await getSignalRoute(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unavailable).toBe(true)
    expect(body.reason).toBe('insufficient history')
  })

  it('/api/signal and /api/forecast compute real metrics when upstream CoinGecko returns OHLC candles', async () => {
    const rawOhlc = candlesFixture.candles.map((c) => [c.t * 1000, c.o, c.h, c.l, c.c])
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(rawOhlc), { status: 200 })
    )

    const sigRes = await getSignalRoute(new Request('http://localhost:3000/api/signal?symbol=BTC'))
    const sigBody = await sigRes.json()
    expect(sigRes.status).toBe(200)
    expect(sigBody.signal).toBe(liveSignal.signal)
    expect(sigBody.components).toHaveLength(5)

    const fcRes = await getForecastRoute(new Request('http://localhost:3000/api/forecast?symbol=BTC&horizon=7'))
    const fcBody = await fcRes.json()
    expect(fcRes.status).toBe(200)
    expect(fcBody.path).toHaveLength(7)
    expect(fcBody.backtest.nTest).toBeGreaterThan(0)
  })

  it('/api/quotes degrades gracefully when CoinGecko rate-limits (HTTP 429)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Too Many Requests', { status: 429 }))
    const req = new Request('http://localhost:3000/api/quotes?symbols=BTC,ETH')
    const res = await getQuotesRoute(req)
    const body = await res.json()
    // getQuotes catches provider failure and returns an empty array rather than fabricated quotes
    expect(res.status).toBe(200)
    expect(body.quotes).toEqual([])
  })

  it('/api/macro reports unavailable when FRED_API_KEY is not configured', async () => {
    const res = await getMacroRoute()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unavailable).toBe(true)
    expect(body.reason).toContain('FRED_API_KEY')
  })

  it('/api/agents rejects unsupported symbols with 400 and degrades to deterministic signal without LLM key', async () => {
    const badRes = await getAgentsRoute(new Request('http://localhost:3000/api/agents?symbol=NOTASYMBOL'))
    expect(badRes.status).toBe(400)

    const rawOhlc = candlesFixture.candles.map((c) => [c.t * 1000, c.o, c.h, c.l, c.c])
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/ohlc')) return new Response(JSON.stringify(rawOhlc), { status: 200 })
      if (url.includes('/simple/price')) {
        return new Response(JSON.stringify({ bitcoin: { usd: 79958, usd_24h_change: -1.4 } }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    })

    const okRes = await getAgentsRoute(new Request('http://localhost:3000/api/agents?symbol=BTC'))
    const okBody = await okRes.json()
    expect(okRes.status).toBe(200)
    expect(okBody.degraded).toBe(true)
    expect(okBody.quantSignal).toBe(liveSignal.signal)
    expect(okBody.analysts).toEqual([])
  })
})
