'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowDownRight, ChevronRight, Shield, BarChart3, Sparkles, Globe2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { SignalBreakdown } from '@/components/signal-breakdown'
import { LiveTicker } from '@/components/ui/live-ticker'
import { ChartWrapper } from '@/components/ui/chart-wrapper'
import { cn } from '@/lib/utils'

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-md border border-border bg-card', className)}>{children}</div>
}

function PanelHeader({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
      <div className="flex items-baseline gap-2">
        <h3 className="section-label">{title}</h3>
        {sub && <span className="font-mono text-[9.5px] text-muted-foreground/70">{sub}</span>}
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary">
          view all <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export function DashboardView() {
  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: api.quotes, refetchInterval: 10_000, staleTime: 8_000 })
  const { data: portfolio } = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio, refetchInterval: 20_000, staleTime: 15_000 })
  const { data: signals } = useQuery({ queryKey: ['signals', 'dashboard'], queryFn: () => api.signals(undefined, '1D'), refetchInterval: 15_000, staleTime: 12_000 })
  const { data: spySignal } = useQuery({ queryKey: ['signal', 'SPY', '1D'], queryFn: () => api.signal('SPY', '1D'), refetchInterval: 15_000, staleTime: 12_000 })

  const equity = portfolio?.equity ?? 0
  const pnl = portfolio?.daily_pnl ?? 0
  const positions = portfolio?.positions ?? 0
  const bullish = (signals ?? []).filter(s => s.signal === 'BUY').length
  const bearish = (signals ?? []).filter(s => s.signal === 'SELL').length
  const scanned = signals?.length ?? 0

  const spySig = spySignal?.signal ?? '—'

  const tiles = [
    {
      label: 'Portfolio value',
      value: `$${equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: positions > 0 ? `${positions} open positions` : 'no positions yet',
      color: 'var(--foreground)',
      up: pnl >= 0,
    },
    {
      label: 'Daily P&L',
      value: `${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(2)}`,
      sub: positions > 0 ? 'marked to last quote' : 'add positions to track',
      color: positions > 0 ? (pnl >= 0 ? 'var(--success)' : 'var(--destructive)') : 'var(--muted-foreground)',
      up: pnl >= 0,
    },
    {
      label: 'SPY composite',
      value: spySig,
      sub: spySignal ? `momentum ${spySignal.momentum >= 0 ? '+' : ''}${spySignal.momentum.toFixed(2)} · 1D` : 'computing…',
      color: spySig === 'BUY' ? 'var(--success)' : spySig === 'SELL' ? 'var(--destructive)' : 'var(--foreground)',
      up: spySig === 'BUY',
    },
    {
      label: 'Signal scan',
      value: scanned ? `${bullish}B / ${bearish}S` : '—',
      sub: scanned ? `${scanned} symbols · technical composite` : 'awaiting scan',
      color: 'var(--chart-2)',
      up: bullish >= bearish,
    },
  ]

  return (
    <div className="max-w-[1600px] space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Dashboard</h1>
        <span className="font-mono text-[10px] text-muted-foreground">
          live quotes · technical signal engine · risk context
        </span>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Panel key={t.label} className="px-3 py-2.5">
            <p className="section-label mb-1.5">{t.label}</p>
            <div className="metric-value" style={{ color: t.color }}>{t.value}</div>
            <div className="mt-1 flex items-center gap-1">
              {t.up
                ? <ArrowUpRight className="h-3 w-3 text-success" />
                : <ArrowDownRight className="h-3 w-3 text-destructive" />}
              <span className="font-mono text-[10px] text-muted-foreground">{t.sub}</span>
            </div>
          </Panel>
        ))}
      </div>

      {/* SPY chart */}
      <ChartWrapper symbol="SPY" timeframe="daily" chartMode="candles" height={300} />
      <LiveTicker />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Signal breakdown — real components, no theater */}
        <Panel className="xl:col-span-2">
          <PanelHeader title="Composite signal" sub="SPY · 1D · computed server-side" href="/signals" />
          <SignalBreakdown symbol="SPY" timeframe="1D" />
        </Panel>

        {/* Right column: market overview + quick nav */}
        <div className="flex flex-col gap-3">
          <Panel>
            <PanelHeader title="Market overview" sub="live quotes" href="/markets" />
            <table className="terminal-table">
              <thead>
                <tr><th>Symbol</th><th className="text-right">Last</th><th className="text-right">Chg</th></tr>
              </thead>
              <tbody>
                {(quotes ?? []).slice(0, 8).map((q) => (
                  <tr key={q.symbol}>
                    <td className="text-foreground">{q.symbol}</td>
                    <td className="text-right text-foreground">{q.price >= 1000 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : q.price.toFixed(2)}</td>
                    <td className={cn('text-right font-semibold', q.change >= 0 ? 'text-success' : 'text-destructive')}>
                      {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {!quotes?.length && (
                  <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Loading quotes…</td></tr>
                )}
              </tbody>
            </table>
          </Panel>

          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/analytics', label: 'Analytics', sub: 'Sharpe · beta · alpha', icon: BarChart3 },
              { href: '/risk', label: 'Risk', sub: 'VaR · CVaR · stress', icon: Shield },
              { href: '/forecast', label: 'Forecast', sub: 'model projections', icon: Sparkles },
              { href: '/macro', label: 'Macro', sub: 'rates · commodities', icon: Globe2 },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="group rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
              >
                <x.icon className="mb-1.5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} />
                <div className="font-mono text-[11px] font-semibold text-foreground">{x.label}</div>
                <div className="font-mono text-[9.5px] text-muted-foreground">{x.sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
