'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowUpRight, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { PriceChart, type Candle } from '@/components/price-chart'
import { EdgeReport } from '@/components/edge-report'
import { Panel, Delta, EmptyState, ErrorState, Skeleton, fmtUsd, fmtPrice } from '@/components/ui/primitives'
import { InfoTip, termForComponent, type GlossaryTerm } from '@/components/ui/glossary'
import type { SignalResult } from '@/lib/market/analysis'
import { cn } from '@/lib/utils'

const CHART_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const

function Kpi({ label, term, value, sub, tone }: { label: string; term: GlossaryTerm; value: React.ReactNode; sub: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 bg-card px-3.5 py-3">
      <span className="inline-flex items-center gap-1.5"><span className="eyebrow">{label}</span><InfoTip term={term} /></span>
      <p className={cn('figure figure-lg mt-1.5 truncate', tone)}>{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

/** Momentum on [-1, +1] with the ±0.3 decision thresholds drawn in. */
function MomentumGauge({ value }: { value: number }) {
  const pos = ((value + 1) / 2) * 100
  return (
    <div aria-label={`Momentum ${value.toFixed(2)} on a scale from -1 to +1; BUY above +0.30, SELL below -0.30`} role="img">
      <div className="relative h-2 rounded-full bg-elevated">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-destructive/25" style={{ width: '35%' }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-success/25" style={{ width: '35%' }} />
        <div className="absolute -inset-y-1 w-px bg-border-strong" style={{ left: '50%' }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" style={{ left: `${pos}%` }} />
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>−1 SELL</span><span className="-ml-6">−0.3</span><span>0</span><span className="-mr-6">+0.3</span><span>BUY +1</span>
      </div>
    </div>
  )
}

function SignalBody({ signal }: { signal: SignalResult }) {
  const maxW = Math.max(...signal.components.map((c) => c.weight), 1)
  return (
    <div className="p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('figure figure-xl', signal.signal === 'BUY' ? 'text-success' : signal.signal === 'SELL' ? 'text-destructive' : 'text-secondary-foreground')}>
          {signal.signal}
        </span>
        <span className="tnum text-xs text-muted-foreground">
          momentum <span className="text-foreground">{signal.momentum >= 0 ? '+' : '−'}{Math.abs(signal.momentum).toFixed(2)}</span>
        </span>
      </div>
      <div className="mt-3"><MomentumGauge value={signal.momentum} /></div>

      <ul className="mt-4 space-y-2.5" aria-label="Indicator votes">
        {signal.components.map((c) => {
          const dir = c.vote === 'bullish' ? 1 : c.vote === 'bearish' ? -1 : 0
          const w = (c.weight / maxW) * 50
          return (
            <li key={c.name} title={c.detail}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium text-foreground">{c.name}</span>
                  {termForComponent(c.name) && <InfoTip term={termForComponent(c.name)!} />}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-muted-foreground">{c.value}</span>
                  <span className={cn('chip', dir > 0 ? 'chip-up' : dir < 0 ? 'chip-down' : 'chip-flat')}>
                    {dir > 0 ? '▲' : dir < 0 ? '▼' : '•'} {c.vote}
                  </span>
                </span>
              </div>
              <div className="vote-track mt-1.5" aria-hidden="true">
                {dir !== 0 && (
                  <div
                    className={cn('vote-fill', dir > 0 ? 'bg-success' : 'bg-destructive')}
                    style={dir > 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
                  />
                )}
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{c.detail} · weight {c.weight}</p>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">{signal.methodology}</p>
    </div>
  )
}

export function DashboardView() {
  const [chartSym, setChartSym] = useState<(typeof CHART_SYMBOLS)[number]>('BTC')
  const [hover, setHover] = useState<Candle | null>(null)

  const portfolioQ = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio })
  const quotesQ = useQuery({ queryKey: ['quotes'], queryFn: () => api.quotes(), refetchInterval: 30_000 })
  const candlesQ = useQuery({ queryKey: ['candles', chartSym, 30], queryFn: () => api.candles(chartSym, 30) })
  const signalQ = useQuery({ queryKey: ['signal', 'BTC'], queryFn: () => api.signal('BTC') })

  const portfolio = portfolioQ.data
  const quotes = quotesQ.data?.quotes ?? []
  const positions = portfolio?.positions ?? []
  const pnl = portfolio?.unrealisedPnl ?? 0
  const quote = quotes.find((q) => q.symbol === chartSym)
  const candles = candlesQ.data?.candles ?? []
  const shown = hover ?? candles.at(-1) ?? null
  const signal = signalQ.data && !signalQ.data.unavailable ? signalQ.data : null

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Dashboard</h1>

      {/* KPI strip — one panel, four cells */}
      <section aria-label="Portfolio summary" className="card-surface grid grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-4">
        {portfolioQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card px-3.5 py-3"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2.5 h-6 w-32" /><Skeleton className="mt-2 h-3 w-20" /></div>
          ))
        ) : portfolioQ.isError ? (
          <div className="col-span-full bg-card"><ErrorState title="Portfolio unavailable" body={(portfolioQ.error as Error).message} onRetry={() => portfolioQ.refetch()} /></div>
        ) : (
          <>
            <Kpi label="Equity" term="portfolioValue" value={fmtUsd(portfolio?.equity ?? 0)} sub={`${positions.length} position${positions.length === 1 ? '' : 's'} · paper`} />
            <Kpi
              label="Unrealised P&L" term="unrealisedPnl"
              value={`${pnl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(pnl))}`}
              tone={positions.length ? (pnl >= 0 ? 'text-success' : 'text-destructive') : undefined}
              sub={positions.length ? <Delta value={portfolio?.unrealisedPnlPct ?? 0} /> : 'no open positions'}
            />
            <Kpi label="Cash" term="invested" value={fmtUsd(portfolio?.cash ?? 0, 0)} sub={`invested ${fmtUsd(portfolio?.invested ?? 0, 0)}`} />
            <Kpi
              label="BTC composite" term="compositeSignal"
              value={signal?.signal ?? (signalQ.isLoading ? '…' : '—')}
              tone={signal?.signal === 'BUY' ? 'text-success' : signal?.signal === 'SELL' ? 'text-destructive' : undefined}
              sub={signal ? `momentum ${signal.momentum >= 0 ? '+' : '−'}${Math.abs(signal.momentum).toFixed(2)} · not a forecast` : 'computing'}
            />
          </>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        {/* Chart */}
        <Panel
          title={<>{chartSym} / USD<span className="hidden sm:inline"> · 30d · 4h bars</span></>}
          actions={
            <>
              <div className="seg" role="group" aria-label="Chart symbol">
                {CHART_SYMBOLS.map((s) => (
                  <button key={s} aria-pressed={s === chartSym} onClick={() => { setChartSym(s); setHover(null) }}>{s}</button>
                ))}
              </div>
              <Link href={`/trade?symbol=${chartSym}`} className="btn-outline h-7 px-2.5 text-xs">
                Trade <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </>
          }
        >
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-3.5 pt-3">
            <div className="flex items-baseline gap-3">
              <span className="figure figure-xl">{quote ? fmtPrice(quote.price) : candles.length ? fmtPrice(candles.at(-1)!.c) : '—'}</span>
              {quote && <Delta value={quote.change} />}
              {quote && <span className="text-[11px] text-muted-foreground">24h · {quote.source}</span>}
            </div>
            {shown && (
              <dl className="tnum flex gap-3 text-[11px]" aria-label={hover ? 'Bar under cursor' : 'Latest bar'}>
                {(['o', 'h', 'l', 'c'] as const).map((k) => (
                  <div key={k} className="flex gap-1">
                    <dt className="uppercase text-muted-foreground">{k}</dt>
                    <dd className="text-foreground">{shown[k].toLocaleString('en-US', { maximumFractionDigits: 2 })}</dd>
                  </div>
                ))}
                <div className="hidden text-muted-foreground sm:block">
                  {new Date(shown.t * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </dl>
            )}
          </div>
          <div className="flex min-h-[300px] flex-1 flex-col px-1 pb-2 pt-1 md:min-h-[340px]" onMouseLeave={() => setHover(null)}>
            {candlesQ.isLoading ? (
              <Skeleton className="mx-2.5 my-2 h-[300px] md:h-[340px]" />
            ) : candlesQ.isError ? (
              <ErrorState title="Chart data failed to load" body={(candlesQ.error as Error).message} onRetry={() => candlesQ.refetch()} />
            ) : candles.length ? (
              <div className="relative min-h-[300px] flex-1 md:min-h-[340px]"><div className="absolute inset-0"><PriceChart candles={candles} mode="area" height="100%" onHover={setHover} /></div></div>
            ) : (
              <div className="p-3"><EmptyState title="No candles for this range" body={candlesQ.data?.reason ?? 'The provider returned nothing. Nothing is invented in its place.'} /></div>
            )}
          </div>
        </Panel>

        {/* Signal */}
        <Panel
          title="Composite signal · BTC"
          term="compositeSignal"
          actions={<span className="hidden text-[11px] text-muted-foreground sm:inline lg:hidden xl:inline">deterministic · every vote shown</span>}
        >
          {signalQ.isLoading ? (
            <div className="space-y-3 p-3.5">
              <Skeleton className="h-8 w-24" /><Skeleton className="h-2 w-full" />
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : signalQ.isError ? (
            <ErrorState title="Signal failed to compute" body={(signalQ.error as Error).message} onRetry={() => signalQ.refetch()} />
          ) : signal ? (
            <SignalBody signal={signal} />
          ) : (
            <div className="p-3.5"><EmptyState title="No signal" body={signalQ.data?.reason ?? 'Not enough history to compute the indicators.'} /></div>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        {/* Markets */}
        <Panel title="Markets" actions={<Link href="/markets" className="text-xs text-muted-foreground hover:text-foreground">All markets →</Link>}>
          {quotesQ.isLoading ? (
            <div className="space-y-2 p-3.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
          ) : quotesQ.isError ? (
            <ErrorState title="Quotes unavailable" body={(quotesQ.error as Error).message} onRetry={() => quotesQ.refetch()} />
          ) : quotes.length ? (
            <div className="overflow-x-auto">
              <table className="terminal-table">
                <thead>
                  <tr><th>Asset</th><th className="text-right">Last</th><th className="text-right">24h</th><th className="hidden text-right sm:table-cell">Source</th></tr>
                </thead>
                <tbody>
                  {quotes.slice(0, 8).map((q) => (
                    <tr key={q.symbol}>
                      <td>
                        <Link href={`/trade?symbol=${q.symbol}`} className="hover:underline">
                          <span className="font-semibold">{q.symbol}</span>
                          <span className="ml-2 text-muted-foreground">{q.name}</span>
                        </Link>
                      </td>
                      <td className="tnum text-right">{fmtPrice(q.price)}</td>
                      <td className="text-right"><Delta value={q.change} className="justify-end" /></td>
                      <td className="hidden text-right text-muted-foreground sm:table-cell">{q.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!quotesQ.data?.equityProvider && (
                <p className="border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
                  Equities hidden: no equity provider key configured on this deployment. Nothing is invented in their place.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5"><EmptyState icon={Wallet} title="No quotes" body="The providers returned nothing." /></div>
          )}
        </Panel>

        <EdgeReport compact />
      </div>
    </div>
  )
}
