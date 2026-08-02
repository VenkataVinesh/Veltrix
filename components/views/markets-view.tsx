'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Eyebrow, EmptyState, fmtPrice } from '@/components/ui/primitives'
import { CRYPTO_SYMBOLS, EQUITY_SYMBOLS } from '@/lib/market/providers'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'crypto' | 'equity'

export function MarketsView() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', 'all'],
    queryFn: () => api.quotes([...CRYPTO_SYMBOLS, ...EQUITY_SYMBOLS]),
    refetchInterval: 30_000,
  })

  const quotes = (data?.quotes ?? [])
    .filter((q) => filter === 'all' || q.assetType === filter)
    .filter((q) =>
      !search ||
      q.symbol.toLowerCase().includes(search.toLowerCase()) ||
      q.name.toLowerCase().includes(search.toLowerCase())
    )

  const equityMissing = data && data.equityProvider === null

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Live prices</Eyebrow>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">Markets</h1>
      </div>

      {equityMissing && (
        <div className="flex items-start gap-3 rounded-2xl bg-primary/10 px-5 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">
            <span className="font-medium">Crypto only right now.</span>{' '}
            <span className="text-muted-foreground">
              Equity prices need a Finnhub API key in <code className="text-foreground">FINNHUB_API_KEY</code>.
              Crypto works without any key.
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-elevated p-1">
          {(['all', 'crypto', 'equity'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets"
            aria-label="Search assets"
            className="w-full rounded-full border border-border bg-elevated py-2.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-elevated" />
            ))}
          </div>
        ) : quotes.length ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">24h change</th>
                  <th className="text-right">Trade</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.symbol}>
                    <td>
                      <span className="font-medium">{q.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{q.name}</span>
                    </td>
                    <td>
                      <span className="chip chip-flat text-[11px] capitalize">{q.assetType}</span>
                    </td>
                    <td className="tnum text-right font-medium">{fmtPrice(q.price)}</td>
                    <td className="text-right">
                      <span className={cn('tnum font-medium', q.change >= 0 ? 'text-success' : 'text-destructive')}>
                        {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right">
                      {q.assetType === 'crypto' ? (
                        <Link href="/trade" className="text-sm font-medium text-primary hover:underline">
                          Trade
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              title="No matching assets"
              body={search ? `Nothing matches "${search}".` : 'No quotes returned by the providers.'}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
