import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market/providers'
import { computeSignal } from '@/lib/market/analysis'

export const revalidate = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase()

  try {
    // 30d on CoinGecko returns 4-hour bars (~180 points) — far more usable for
    // indicators than 90d+, which switches to sparse 4-day candles.
    const candles = await getCandles(symbol, 30)
    if ('unavailable' in candles) {
      return NextResponse.json({ symbol, unavailable: true, reason: candles.reason })
    }
    const signal = computeSignal(symbol, candles)
    if (!signal) {
      return NextResponse.json({ symbol, unavailable: true, reason: 'insufficient history' })
    }
    return NextResponse.json(signal)
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : 'signal failed' },
      { status: 502 }
    )
  }
}
