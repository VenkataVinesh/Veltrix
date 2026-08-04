/**
 * Evidence gathering for the agent debate.
 *
 * Every agent is given real, sourced numbers — never a free-text prompt
 * asking a model to recall a price. If a source is unavailable the field
 * is simply absent and the prompt says so, so an agent can reason about
 * missing evidence rather than hallucinating it.
 */

import { getCandles, getQuotes, assetTypeOf, type Quote } from '@/lib/market/providers'
import { computeSignal, type SignalResult } from '@/lib/market/analysis'

const FINNHUB = process.env.FINNHUB_API_KEY?.trim() || ''
const FRED = process.env.FRED_API_KEY?.trim() || ''

export interface Headline {
  headline: string
  source: string
  url: string
  at: string
}

export interface MacroPoint {
  id: string
  label: string
  value: number
  unit: string
  asOf: string
}

export interface DebateContext {
  symbol: string
  assetType: 'equity' | 'crypto'
  quote: Quote | null
  signal: SignalResult | null
  headlines: Headline[]
  macro: MacroPoint[]
  missing: string[]
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

async function fetchHeadlines(symbol: string): Promise<Headline[]> {
  if (!FINNHUB || assetTypeOf(symbol) !== 'equity') return []
  const to = new Date()
  const from = new Date(to.getTime() - 14 * 86400_000)
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}` +
        `&from=${ymd(from)}&to=${ymd(to)}&token=${FINNHUB}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return []
    const raw = (await res.json()) as {
      headline?: string; source?: string; url?: string; datetime?: number
    }[]
    return raw
      .filter((r) => r.headline)
      .slice(0, 8)
      .map((r) => ({
        headline: r.headline!.slice(0, 200),
        source: r.source ?? 'unknown',
        url: r.url ?? '',
        at: r.datetime ? new Date(r.datetime * 1000).toISOString() : '',
      }))
  } catch {
    return []
  }
}

const FRED_SERIES: { id: string; label: string; unit: string }[] = [
  { id: 'DGS10', label: '10-year Treasury yield', unit: '%' },
  { id: 'DGS2', label: '2-year Treasury yield', unit: '%' },
  { id: 'UNRATE', label: 'Unemployment rate', unit: '%' },
]

async function fetchMacro(): Promise<MacroPoint[]> {
  if (!FRED) return []
  const out = await Promise.all(
    FRED_SERIES.map(async (s): Promise<MacroPoint | null> => {
      try {
        const res = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}` +
            `&api_key=${FRED}&file_type=json&limit=1&sort_order=desc`,
          { next: { revalidate: 21_600 } }
        )
        if (!res.ok) return null
        const d = (await res.json()) as { observations?: { date: string; value: string }[] }
        const o = d.observations?.[0]
        const value = parseFloat(o?.value ?? '')
        // FRED uses "." for a missing observation.
        if (!o || !Number.isFinite(value)) return null
        return { id: s.id, label: s.label, value, unit: s.unit, asOf: o.date }
      } catch {
        return null
      }
    })
  )
  return out.filter((m): m is MacroPoint => m !== null)
}

export async function gatherContext(symbol: string): Promise<DebateContext> {
  const sym = symbol.toUpperCase()
  const assetType = assetTypeOf(sym)
  const missing: string[] = []

  const [candles, quotes, headlines, macro] = await Promise.all([
    getCandles(sym, assetType === 'crypto' ? 30 : 90),
    getQuotes([sym]).catch(() => [] as Quote[]),
    fetchHeadlines(sym),
    fetchMacro(),
  ])

  let signal: SignalResult | null = null
  if ('unavailable' in candles) {
    missing.push(`price history (${candles.reason})`)
  } else {
    signal = computeSignal(sym, candles)
    if (!signal) missing.push('technical signal (insufficient history)')
  }
  if (!quotes.length) missing.push('live quote')
  if (!headlines.length) missing.push(assetType === 'equity' ? 'company news' : 'news (crypto news not wired)')
  if (!macro.length) missing.push('macro series')

  return {
    symbol: sym,
    assetType,
    quote: quotes[0] ?? null,
    signal,
    headlines,
    macro,
    missing,
  }
}

/** Compact, factual evidence brief shared by every agent. */
export function renderEvidence(ctx: DebateContext): string {
  const L: string[] = [`SYMBOL: ${ctx.symbol} (${ctx.assetType})`]

  if (ctx.quote) {
    L.push(
      `PRICE: ${ctx.quote.price} (${ctx.quote.change >= 0 ? '+' : ''}${ctx.quote.change.toFixed(2)}% 24h) [source: ${ctx.quote.source}]`
    )
  }

  if (ctx.signal) {
    const s = ctx.signal
    L.push(
      `TECHNICALS: composite=${s.signal} momentum=${s.momentum} trend=${s.trend} ` +
        `volatility=${s.volatility} support=${s.support} resistance=${s.resistance}`
    )
    L.push('INDICATOR VOTES:')
    for (const c of s.components) {
      L.push(`  - ${c.name}: value=${c.value} vote=${c.vote} weight=${c.weight} (${c.detail})`)
    }
  }

  if (ctx.headlines.length) {
    L.push('RECENT HEADLINES:')
    for (const h of ctx.headlines) L.push(`  - "${h.headline}" (${h.source})`)
  }

  if (ctx.macro.length) {
    L.push('MACRO:')
    for (const m of ctx.macro) L.push(`  - ${m.label}: ${m.value}${m.unit} as of ${m.asOf}`)
  }

  if (ctx.missing.length) {
    L.push(`UNAVAILABLE EVIDENCE: ${ctx.missing.join(', ')}`)
    L.push('Do not speculate about unavailable evidence. Say it is unknown.')
  }

  return L.join('\n')
}
