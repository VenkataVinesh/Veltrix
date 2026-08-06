/** Typed fetchers for the app's own API routes. */

import type { SignalResult, ForecastResult } from '@/lib/market/analysis'
import type { Quote, Candle } from '@/lib/market/providers'
import type { MacroReading } from '@/lib/market/macro'
import type { DebateResult } from '@/lib/agents/engine'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json() as Promise<T>
}

export interface Position {
  id: string
  symbol: string
  assetType: 'equity' | 'crypto'
  quantity: number
  avgPrice: number
  price: number
  change: number
  marketValue: number
  cost: number
  pnl: number
  pnlPct: number
  priced: boolean
}

export interface PortfolioResponse {
  portfolioId?: string
  name?: string
  cash: number
  positions: Position[]
  marketValue: number
  invested: number
  equity: number
  unrealisedPnl: number
  unrealisedPnlPct: number
}

export const api = {
  quotes: (symbols?: string[]) =>
    get<{ quotes: Quote[]; equityProvider: string | null }>(
      `/api/quotes${symbols?.length ? `?symbols=${symbols.join(',')}` : ''}`
    ),

  candles: (symbol: string, days = 90) =>
    get<{ symbol: string; candles: Candle[]; unavailable?: boolean; reason?: string }>(
      `/api/candles?symbol=${encodeURIComponent(symbol)}&days=${days}`
    ),

  signal: (symbol: string) =>
    get<SignalResult & { unavailable?: boolean; reason?: string }>(
      `/api/signal?symbol=${encodeURIComponent(symbol)}`
    ),

  forecast: (symbol: string, horizon = 14) =>
    get<ForecastResult & { unavailable?: boolean; reason?: string }>(
      `/api/forecast?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`
    ),

  /** Multi-agent debate. Slow by nature (several LLM round-trips), so
   *  callers should treat it as an on-demand action, not a page load. */
  agents: (symbol: string) =>
    get<DebateResult & { cached?: boolean; error?: string }>(
      `/api/agents?symbol=${encodeURIComponent(symbol)}`
    ),

  macro: () =>
    get<{ series?: MacroReading[]; unavailable?: boolean; reason?: string }>('/api/macro'),

  portfolio: () => get<PortfolioResponse>('/api/portfolio'),

  addPosition: async (body: {
    symbol: string; quantity: number; avgPrice: number; assetType: 'equity' | 'crypto'
  }) => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Could not add position')
    return json
  },

  removePosition: async (id: string) => {
    const res = await fetch(`/api/portfolio?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Could not remove position')
    return json
  },
}
