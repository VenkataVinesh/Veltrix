import { NextResponse } from 'next/server'
import { runDebate } from '@/lib/agents/engine'
import { CRYPTO_IDS, EQUITY_NAMES } from '@/lib/market/providers'

// A debate is several LLM round-trips; never statically cached.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Symbol -> {result, expires}. Debates are expensive and free tiers are
 *  rate-limited, so an identical request inside the window is served from
 *  memory. Per-instance only, which is the right scope for a soft cache. */
const cache = new Map<string, { at: number; data: unknown }>()
const TTL_MS = 10 * 60 * 1000

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase()

  if (!CRYPTO_IDS[symbol] && !EQUITY_NAMES[symbol]) {
    return NextResponse.json(
      { symbol, error: 'unsupported symbol' },
      { status: 400 }
    )
  }

  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...(hit.data as object), cached: true })
  }

  try {
    const result = await runDebate(symbol)
    // Only cache a full debate — a degraded run should be retried.
    if (!result.degraded) cache.set(symbol, { at: Date.now(), data: result })
    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    return NextResponse.json(
      { symbol, error: err instanceof Error ? err.message : 'debate failed' },
      { status: 502 }
    )
  }
}
