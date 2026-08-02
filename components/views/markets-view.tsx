'use client'

import { useState, useMemo } from 'react'
import { BarChart2, Activity, Layers } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TradingChart, type ChartMode } from '@/components/trading-chart'
import { OrderBook } from '@/components/order-book'
import { Watchlist } from '@/components/watchlist'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']
const SYMBOLS = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'BTC']
type IndicatorKey = 'volume' | 'ema' | 'sma' | 'bollinger' | 'rsi' | 'macd'

const INDICATOR_OPTIONS: { key: IndicatorKey; label: string }[] = [
  { key: 'volume', label: 'VOL' },
  { key: 'ema', label: 'EMA' },
  { key: 'sma', label: 'SMA' },
  { key: 'bollinger', label: 'BB' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
]

function SegGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-px rounded-md border border-border bg-secondary p-0.5">{children}</div>
}

function SegButton({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'rounded-[4px] px-2 py-1 font-mono text-[11px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function MarketsView() {
  const [symbol, setSymbol] = useState('SPY')
  const [tf, setTf] = useState('1H')
  const [chartMode, setChartMode] = useState<ChartMode>('candles')
  const [indicators, setIndicators] = useState({
    volume: true, ema: true, sma: false, bollinger: true, rsi: false, macd: false,
  })

  const { data: quoteData } = useQuery({ queryKey: ['quotes'], queryFn: api.quotes, staleTime: 10_000 })
  const { data: signal } = useQuery({
    queryKey: ['signal', symbol, tf],
    queryFn: () => api.signal(symbol, tf),
    refetchInterval: 12_000,
    staleTime: 10_000,
  })

  const quote = useMemo(() => quoteData?.find(q => q.symbol === symbol), [symbol, quoteData])
  const toggleIndicator = (key: IndicatorKey) => setIndicators(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="flex h-full max-w-[1600px] flex-col gap-3">

      {/* ─── Controls bar ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-sm font-semibold text-foreground">{symbol}</span>
          {quote && (
            <>
              <span className="metric-value text-lg">${quote.price.toFixed(2)}</span>
              <span className={cn('font-mono text-xs font-semibold', quote.change >= 0 ? 'text-success' : 'text-destructive')}>
                {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%
              </span>
            </>
          )}
        </div>

        <div className="flex-1" />

        <SegGroup>
          {SYMBOLS.map(s => (
            <SegButton key={s} active={s === symbol} onClick={() => setSymbol(s)}>{s}</SegButton>
          ))}
        </SegGroup>

        <SegGroup>
          {TIMEFRAMES.map(t => (
            <SegButton key={t} active={t === tf} onClick={() => setTf(t)}>{t}</SegButton>
          ))}
        </SegGroup>

        <SegGroup>
          {([['candles', BarChart2], ['line', Activity], ['bar', Layers]] as [ChartMode, React.ElementType][]).map(([mode, Icon]) => (
            <SegButton key={mode} active={mode === chartMode} onClick={() => setChartMode(mode)} label={`${mode} chart`}>
              <Icon className="h-3.5 w-3.5" />
            </SegButton>
          ))}
        </SegGroup>
      </div>

      {/* ─── Main chart area ─── */}
      <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-4">

        {/* Chart column */}
        <div className="flex flex-col gap-3 xl:col-span-3">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {/* Indicator toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-border px-2.5 py-1.5">
              {INDICATOR_OPTIONS.map(ind => (
                <button
                  key={ind.key}
                  onClick={() => toggleIndicator(ind.key)}
                  aria-pressed={indicators[ind.key]}
                  className={cn(
                    'rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-medium transition-colors',
                    indicators[ind.key]
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {ind.label}
                </button>
              ))}
              <div className="flex-1" />
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/70">
                {symbol} · {tf}
              </span>
            </div>

            <TradingChart
              symbol={symbol}
              timeframe={tf}
              chartMode={chartMode}
              indicators={indicators}
              height={indicators.rsi && indicators.macd ? 560 : indicators.rsi || indicators.macd ? 520 : 460}
            />
          </div>

          {/* Signal readout — real values from the technical engine */}
          {signal && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                {
                  label: 'Composite signal',
                  value: signal.signal,
                  color: signal.signal === 'BUY' ? 'var(--success)' : signal.signal === 'SELL' ? 'var(--destructive)' : 'var(--foreground)',
                },
                { label: 'Support', value: `$${(signal.support ?? 0).toFixed(2)}`, color: 'var(--success)' },
                { label: 'Resistance', value: `$${(signal.resistance ?? 0).toFixed(2)}`, color: 'var(--destructive)' },
                { label: 'ATR volatility', value: `${((signal.volatility ?? 0) * 100).toFixed(2)}%`, color: 'var(--chart-2)' },
              ].map(b => (
                <div key={b.label} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="section-label mb-1">{b.label}</p>
                  <p className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: b.color }}>{b.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel — Order book + Watchlist */}
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
              <h3 className="section-label">Order book</h3>
              <span className="font-mono text-[9.5px] text-muted-foreground/70">depth</span>
            </div>
            <div style={{ height: 280 }}>
              <OrderBook symbol={symbol} />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
              <h3 className="section-label">Watchlist</h3>
              <span className="font-mono text-[9.5px] text-muted-foreground/70">tracked</span>
            </div>
            <Watchlist />
          </div>
        </div>
      </div>
    </div>
  )
}
