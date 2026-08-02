'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PriceChart } from '@/components/price-chart'
import { Card, Eyebrow, DeltaChip, Stat, EmptyState, fmtUsd, fmtPrice } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function DashboardView() {
  const { data: portfolio, isLoading: pLoading } = useQuery({
    queryKey: ['portfolio'], queryFn: api.portfolio,
  })
  const { data: quoteData } = useQuery({
    queryKey: ['quotes'], queryFn: () => api.quotes(), refetchInterval: 30_000,
  })
  const { data: candleData } = useQuery({
    queryKey: ['candles', 'BTC', 30], queryFn: () => api.candles('BTC', 30),
  })
  const { data: signal } = useQuery({
    queryKey: ['signal', 'BTC'], queryFn: () => api.signal('BTC'),
  })

  const quotes = quoteData?.quotes ?? []
  const equity = portfolio?.equity ?? 0
  const pnl = portfolio?.unrealisedPnl ?? 0
  const pnlPct = portfolio?.unrealisedPnlPct ?? 0
  const positions = portfolio?.positions ?? []

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Overview</Eyebrow>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">Dashboard</h1>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><div className="h-[86px] animate-pulse rounded-xl bg-elevated" /></Card>
          ))
        ) : (
          <>
            <Stat
              label="Portfolio value"
              value={fmtUsd(equity, 2)}
              sub={`${positions.length} position${positions.length === 1 ? '' : 's'} · cash ${fmtUsd(portfolio?.cash ?? 0, 0)}`}
            />
            <Stat
              label="Unrealised P&L"
              value={`${pnl >= 0 ? '+' : ''}${fmtUsd(pnl, 2)}`}
              delta={positions.length ? pnlPct : undefined}
              sub={positions.length ? 'marked to live prices' : 'add a position to track'}
            />
            <Stat
              label="Invested"
              value={fmtUsd(portfolio?.invested ?? 0, 2)}
              sub={`market value ${fmtUsd(portfolio?.marketValue ?? 0, 2)}`}
            />
            <Stat
              label="BTC composite"
              value={signal?.signal ?? '—'}
              sub={signal ? `momentum ${signal.momentum >= 0 ? '+' : ''}${signal.momentum.toFixed(2)}` : 'computing…'}
            />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        {/* Chart */}
        <Card className="p-0">
          <div className="flex items-center justify-between p-6 pb-2">
            <div>
              <Eyebrow>Bitcoin · 30d</Eyebrow>
              <p className="figure figure-lg mt-2">
                {quotes.find((q) => q.symbol === 'BTC')
                  ? fmtPrice(quotes.find((q) => q.symbol === 'BTC')!.price)
                  : '—'}
              </p>
            </div>
            <Link href="/trade" className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm">
              Trade <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-2 pb-4">
            {candleData?.candles.length ? (
              <PriceChart candles={candleData.candles} mode="area" height={300} />
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </Card>

        {/* Signal breakdown — every vote visible */}
        <Card>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Signal breakdown · BTC</Eyebrow>
            {signal?.signal && (
              <span className={cn(
                'chip',
                signal.signal === 'BUY' ? 'chip-up' : signal.signal === 'SELL' ? 'chip-down' : 'chip-flat'
              )}>
                {signal.signal}
              </span>
            )}
          </div>

          {signal?.components?.length ? (
            <>
              <div className="mt-5 space-y-3">
                {signal.components.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-3" title={c.detail}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-sm text-muted-foreground">{c.value}</span>
                      <span className={cn(
                        'chip text-[11px]',
                        c.vote === 'bullish' ? 'chip-up' : c.vote === 'bearish' ? 'chip-down' : 'chip-flat'
                      )}>
                        {c.vote}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                {signal.methodology}
              </p>
            </>
          ) : (
            <div className="mt-4 flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </Card>
      </div>

      {/* Markets */}
      <Card className="p-0">
        <div className="flex items-center justify-between p-6 pb-4">
          <Eyebrow>Markets</Eyebrow>
          <Link href="/markets" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {quotes.length ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr><th>Asset</th><th className="text-right">Price</th><th className="text-right">24h</th></tr>
              </thead>
              <tbody>
                {quotes.slice(0, 8).map((q) => (
                  <tr key={q.symbol}>
                    <td>
                      <span className="font-medium">{q.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{q.name}</span>
                    </td>
                    <td className="tnum text-right">{fmtPrice(q.price)}</td>
                    <td className="text-right">
                      <span className={cn('tnum font-medium', q.change >= 0 ? 'text-success' : 'text-destructive')}>
                        {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 pt-0">
            <EmptyState title="Loading markets" body="Fetching live quotes from the providers." />
          </div>
        )}
      </Card>
    </div>
  )
}
