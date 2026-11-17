import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/market/providers'
import { DEMO_COOKIE } from '@/middleware'

export const dynamic = 'force-dynamic'

/**
 * Seeded read-only demo positions so a logged-out reviewer can inspect the
 * portfolio and dashboard views without creating an account. Every response
 * carries `isDemo: true` and `demoNotice` so it is explicitly labelled as
 * seeded demo data everywhere it renders.
 */
const DEMO_SEED_CASH = 42_500
const DEMO_SEED_POSITIONS = [
  { id: 'demo-btc', symbol: 'BTC', asset_type: 'crypto' as const, quantity: 0.45, avg_price: 76_200 },
  { id: 'demo-eth', symbol: 'ETH', asset_type: 'crypto' as const, quantity: 6.0, avg_price: 2_650 },
  { id: 'demo-sol', symbol: 'SOL', asset_type: 'crypto' as const, quantity: 55.0, avg_price: 168 },
]

async function requireUser() {
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith('sb-'))
  const demoCookie = cookieStore.get(DEMO_COOKIE)?.value === '1'
  if (demoCookie && !hasAuthCookie) {
    return { supabase: null, user: null, isDemo: true }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isDemo = !user && demoCookie
  return { supabase, user, isDemo }
}

async function enrichPositions(
  rows: { id: string; symbol: string; asset_type: 'equity' | 'crypto'; quantity: number; avg_price: number }[],
  cash: number,
  meta: { portfolioId: string; name: string; isDemo?: boolean; demoNotice?: string }
) {
  if (!rows.length) {
    return {
      ...meta,
      cash,
      positions: [],
      equity: cash,
      invested: 0,
      marketValue: 0,
      unrealisedPnl: 0,
      unrealisedPnlPct: 0,
    }
  }

  const quotes = await getQuotes([...new Set(rows.map((r) => r.symbol))])
  const priceOf = new Map(quotes.map((q) => [q.symbol, q]))

  const enriched = rows.map((r) => {
    const q = priceOf.get(r.symbol)
    const qty = Number(r.quantity)
    const avg = Number(r.avg_price)
    const price = q?.price ?? avg
    const marketValue = qty * price
    const cost = qty * avg
    return {
      id: r.id,
      symbol: r.symbol,
      assetType: r.asset_type,
      quantity: qty,
      avgPrice: avg,
      price,
      change: q?.change ?? 0,
      marketValue: +marketValue.toFixed(2),
      cost: +cost.toFixed(2),
      pnl: +(marketValue - cost).toFixed(2),
      pnlPct: cost > 0 ? +(((marketValue - cost) / cost) * 100).toFixed(2) : 0,
      priced: Boolean(q),
    }
  })

  const marketValue = enriched.reduce((s, p) => s + p.marketValue, 0)
  const invested = enriched.reduce((s, p) => s + p.cost, 0)

  return {
    ...meta,
    cash,
    positions: enriched,
    marketValue: +marketValue.toFixed(2),
    invested: +invested.toFixed(2),
    equity: +(marketValue + cash).toFixed(2),
    unrealisedPnl: +(marketValue - invested).toFixed(2),
    unrealisedPnlPct: invested > 0 ? +(((marketValue - invested) / invested) * 100).toFixed(2) : 0,
  }
}

/** Holdings marked to live prices. */
export async function GET() {
  const { supabase, user, isDemo } = await requireUser()

  if (!user && isDemo) {
    const body = await enrichPositions(DEMO_SEED_POSITIONS, DEMO_SEED_CASH, {
      portfolioId: 'demo-portfolio',
      name: 'Seeded Demo Portfolio (Read-only)',
      isDemo: true,
      demoNotice:
        'SEEDED DEMO DATA: Pre-populated paper holdings (0.45 BTC, 6 ETH, 55 SOL + $42.5k cash) marked to live CoinGecko prices.',
    })
    return NextResponse.json(body)
  }

  if (!user || !supabase) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: portfolio } = await supabase
    .from('portfolios').select('id, name, cash').eq('user_id', user.id).limit(1).single()

  if (!portfolio) return NextResponse.json({ positions: [], equity: 0, cash: 0, dailyPnl: 0 })

  const { data: positions } = await supabase
    .from('positions').select('id, symbol, asset_type, quantity, avg_price')
    .eq('portfolio_id', portfolio.id)

  const body = await enrichPositions(
    (positions ?? []) as { id: string; symbol: string; asset_type: 'equity' | 'crypto'; quantity: number; avg_price: number }[],
    Number(portfolio.cash),
    { portfolioId: portfolio.id, name: portfolio.name, isDemo: false }
  )
  return NextResponse.json(body)
}

/** Add a position. */
export async function POST(req: Request) {
  const { supabase, user, isDemo } = await requireUser()
  if (!user && isDemo) {
    return NextResponse.json(
      { error: 'Demo mode is read-only. Create a free account to place paper trades or edit positions.' },
      { status: 403 }
    )
  }
  if (!user || !supabase) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { symbol?: string; quantity?: number; avgPrice?: number; assetType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const symbol = String(body.symbol ?? '').trim().toUpperCase()
  const quantity = Number(body.quantity)
  const avgPrice = Number(body.avgPrice)

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be greater than 0' }, { status: 400 })
  }
  if (!Number.isFinite(avgPrice) || avgPrice < 0) {
    return NextResponse.json({ error: 'avgPrice must be 0 or greater' }, { status: 400 })
  }

  const { data: portfolio } = await supabase
    .from('portfolios').select('id').eq('user_id', user.id).limit(1).single()
  if (!portfolio) return NextResponse.json({ error: 'no portfolio' }, { status: 404 })

  const assetType = body.assetType === 'crypto' || body.assetType === 'equity'
    ? body.assetType
    : 'equity'

  const { data, error } = await supabase
    .from('positions')
    .insert({ portfolio_id: portfolio.id, symbol, quantity, avg_price: avgPrice, asset_type: assetType })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ position: data }, { status: 201 })
}

/** Remove a position (RLS scopes the delete to the caller's own rows). */
export async function DELETE(req: Request) {
  const { supabase, user, isDemo } = await requireUser()
  if (!user && isDemo) {
    return NextResponse.json(
      { error: 'Demo mode is read-only. Create a free account to remove positions.' },
      { status: 403 }
    )
  }
  if (!user || !supabase) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
