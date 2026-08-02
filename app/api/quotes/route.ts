import { NextResponse } from 'next/server'
import { getQuotes, CRYPTO_SYMBOLS, EQUITY_SYMBOLS, hasEquityProvider } from '@/lib/market/providers'

export const revalidate = 20

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const param = searchParams.get('symbols')
  const symbols = param
    ? param.split(',').map((s) => s.trim()).filter(Boolean)
    : [...CRYPTO_SYMBOLS.slice(0, 6), ...EQUITY_SYMBOLS.slice(0, 6)]

  try {
    const quotes = await getQuotes(symbols)
    return NextResponse.json({
      quotes,
      equityProvider: hasEquityProvider() ? 'finnhub' : null,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { quotes: [], error: err instanceof Error ? err.message : 'quote fetch failed' },
      { status: 502 }
    )
  }
}
