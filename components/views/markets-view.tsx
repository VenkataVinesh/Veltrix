'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Delta, Eyebrow, EmptyState, ErrorState, fmtPrice } from '@/components/ui/primitives'
import { CRYPTO_SYMBOLS, EQUITY_SYMBOLS } from '@/lib/market/providers'

type Filter = 'all' | 'crypto' | 'equity'

export function MarketsView() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
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
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Markets</h1>
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
        <div className="seg" role="group" aria-label="Asset type">
          {(['all', 'crypto', 'equity'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className="capitalize">{f}</button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets"
            aria-label="Search assets"
            className="h-7 w-full rounded-md border border-border bg-elevated pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
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
        ) : isError ? (
          <ErrorState
            title="Market quotes unavailable"
            body={(error as Error)?.message ?? 'Could not reach the quote providers.'}
            onRetry={() => refetch()}
          />
        ) : quotes.length ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <caption className="sr-only">Market quotes by asset</caption>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">Price</th>
                  <th scope="col" className="text-right">24h change</th>
                  <th scope="col" className="text-right">Trade</th>
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
                      <Delta value={q.change} className="justify-end" />
                    </td>
                    <td className="text-right">
                      {q.assetType === 'crypto' ? (
                        <Link href={`/trade?symbol=${q.symbol}`} className="text-sm font-medium text-primary hover:underline">
                          Trade
                        </Link>
                      ) : (
                        <Link href={`/intelligence?symbol=${q.symbol}`} className="text-sm text-secondary-foreground hover:text-foreground hover:underline">
                          Intel
                        </Link>
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
