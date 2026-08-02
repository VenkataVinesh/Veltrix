import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/market/providers'

export const dynamic = 'force-dynamic'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Holdings marked to live prices. */
export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: portfolio } = await supabase
    .from('portfolios').select('id, name, cash').eq('user_id', user.id).limit(1).single()

  if (!portfolio) return NextResponse.json({ positions: [], equity: 0, cash: 0, dailyPnl: 0 })

  const { data: positions } = await supabase
    .from('positions').select('id, symbol, asset_type, quantity, avg_price')
    .eq('portfolio_id', portfolio.id)

  const rows = positions ?? []
  if (!rows.length) {
    return NextResponse.json({
      portfolioId: portfolio.id, name: portfolio.name,
      cash: Number(portfolio.cash), positions: [], equity: Number(portfolio.cash),
      invested: 0, marketValue: 0, unrealisedPnl: 0, unrealisedPnlPct: 0,
    })
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

  return NextResponse.json({
    portfolioId: portfolio.id,
    name: portfolio.name,
    cash: Number(portfolio.cash),
    positions: enriched,
    marketValue: +marketValue.toFixed(2),
    invested: +invested.toFixed(2),
    equity: +(marketValue + Number(portfolio.cash)).toFixed(2),
    unrealisedPnl: +(marketValue - invested).toFixed(2),
    unrealisedPnlPct: invested > 0 ? +(((marketValue - invested) / invested) * 100).toFixed(2) : 0,
  })
}

/** Add a position. */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

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
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
