import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market/providers'

export const revalidate = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase()
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 90, 1), 365)

  try {
    const candles = await getCandles(symbol, days)
    if ('unavailable' in candles) {
      return NextResponse.json({ symbol, candles: [], unavailable: true, reason: candles.reason })
    }
    return NextResponse.json({ symbol, days, candles })
  } catch (err) {
    return NextResponse.json(
      { symbol, candles: [], error: err instanceof Error ? err.message : 'candle fetch failed' },
      { status: 502 }
    )
  }
}
