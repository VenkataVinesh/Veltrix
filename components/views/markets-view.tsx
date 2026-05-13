'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Activity, Layers, TrendingUp, Target, Zap, Flame, Waves } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TradingChart, type ChartMode } from '@/components/trading-chart'
import { OrderBook } from '@/components/order-book'
import { Watchlist } from '@/components/watchlist'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']
const SYMBOLS = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'BTC']
type IndicatorKey = 'volume' | 'rsi' | 'macd' | 'ema' | 'sma' | 'bollinger' | 'volumeProfile'

const INDICATOR_OPTIONS: { key: IndicatorKey; label: string }[] = [
  { key: 'volume',        label: 'Vol' },
  { key: 'ema',           label: 'EMA' },
  { key: 'sma',           label: 'SMA' },
  { key: 'bollinger',     label: 'BB' },
  { key: 'rsi',           label: 'RSI' },
  { key: 'macd',          label: 'MACD' },
  { key: 'volumeProfile', label: 'VP' },
]

export function MarketsView() {
  const [symbol, setSymbol] = useState('SPY')
  const [tf, setTf] = useState('1H')
  const [chartMode, setChartMode] = useState<ChartMode>('candles')
  const [indicators, setIndicators] = useState({
    volume: true, rsi: false, macd: false,
    ema: true, sma: false, bollinger: true, volumeProfile: false,
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
    <div className="flex flex-col gap-4 h-full max-w-[1600px]">

      {/* ─── Controls bar ─── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3">
        {/* Symbol + price */}
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold font-mono text-white">{symbol}</div>
          {quote && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-white">${quote.price.toFixed(2)}</span>
              <span className={cn('text-sm font-mono', quote.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Symbol selector */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(16,19,26,0.72)', border: '1px solid rgba(220,232,255,0.08)' }}>
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                s === symbol ? 'bg-[#dce8ff] text-black' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(16,19,26,0.72)', border: '1px solid rgba(220,232,255,0.08)' }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                t === tf ? 'bg-[#dce8ff] text-black' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Chart type */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(16,19,26,0.72)', border: '1px solid rgba(220,232,255,0.08)' }}>
          {([['candles', BarChart2], ['line', Activity], ['bar', Layers]] as [ChartMode, React.ElementType][]).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setChartMode(mode)}
              className={cn('p-2 rounded-lg transition-all', mode === chartMode ? 'bg-[#dce8ff] text-black' : 'text-gray-500 hover:text-gray-300')}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* ─── Main chart area ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-1">

        {/* Chart column */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            {/* Indicator toolbar */}
            <div
              className="rounded-t-2xl px-4 py-2.5 flex items-center gap-2 flex-wrap"
              style={{ background: 'rgba(16,19,26,0.72)', border: '1px solid rgba(220,232,255,0.08)', borderBottom: 'none' }}
            >
              {INDICATOR_OPTIONS.map(ind => (
                <button
                  key={ind.key}
                  onClick={() => toggleIndicator(ind.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                    indicators[ind.key]
                      ? 'bg-[#8fd8ff]/10 text-[#8fd8ff] border-[#8fd8ff]/25'
                      : 'text-gray-600 border-transparent hover:text-gray-400'
                  )}
                >
                  {ind.label}
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-[10px] text-gray-700 font-mono">{symbol} · {tf} · data refreshes on change</span>
            </div>

            {/* Chart — TradingChart manages its own container sizing */}
            <TradingChart
              symbol={symbol}
              timeframe={tf}
              chartMode={chartMode}
              indicators={indicators}
              height={480}
            />
          </motion.div>

          {/* AI signal overlay badges */}
          {signal && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Signal', value: signal.signal, color: signal.signal === 'BUY' ? '#61f2b2' : signal.signal === 'SELL' ? '#ff6b7a' : '#dce8ff' },
                { label: 'Support', value: `$${(signal.support ?? 0).toFixed(2)}`, color: '#10b981' },
                { label: 'Target', value: `$${(signal.target_up ?? 0).toFixed(2)}`, color: '#8fd8ff' },
                { label: 'Confidence', value: `${Math.round(signal.confidence * 100)}%`, color: '#06b6d4' },
              ].map(b => (
                <div key={b.label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(5,5,7,0.52)', border: '1px solid rgba(220,232,255,0.07)' }}>
                  <p className="text-[10px] text-gray-600 mb-1">{b.label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color: b.color }}>{b.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Right panel — Order book + Watchlist */}
        <div className="flex flex-col gap-4">
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="premium-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.03]">
                <h3 className="text-sm font-semibold text-white">Order Book</h3>
                <p className="text-xs text-gray-600 mt-0.5">Market depth</p>
              </div>
              <div style={{ height: 280 }}>
                <OrderBook symbol={symbol} />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="premium-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.03]">
                <h3 className="text-sm font-semibold text-white">Watchlist</h3>
                <p className="text-xs text-gray-600 mt-0.5">Tracked assets</p>
              </div>
              <Watchlist />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
