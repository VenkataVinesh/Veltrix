import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market/providers'
import { computeForecast } from '@/lib/market/analysis'

export const revalidate = 120

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase()
  const horizon = Math.min(Math.max(Number(searchParams.get('horizon')) || 14, 1), 60)

  try {
    const candles = await getCandles(symbol, 180)
    if ('unavailable' in candles) {
      return NextResponse.json({ symbol, unavailable: true, reason: candles.reason })
    }
    const forecast = computeForecast(symbol, candles, horizon)
    if (!forecast) {
      return NextResponse.json({ symbol, unavailable: true, reason: 'insufficient history' })
    }
    return NextResponse.json(forecast)
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : 'forecast failed' },
      { status: 502 }
    )
  }
}
