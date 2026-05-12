'use client'

import { useMemo, useState, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { 
  Clock, 
  Layers, 
  BarChart2, 
  TrendingUp,
  Zap,
  Target,
  Activity,
  Waves,
  Flame
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '@/components/glass-panel'
import { TradingChart } from '@/components/trading-chart'
import { OrderBook } from '@/components/order-book'
import { Watchlist } from '@/components/watchlist'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']
const symbolUniverse = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN']

type ChartMode = 'candles' | 'line' | 'bar'

type IndicatorState = {
  volume: boolean
  rsi: boolean
  macd: boolean
  ema: boolean
  sma: boolean
  bollinger: boolean
  volumeProfile: boolean
}

export function MarketsView() {
  const [activeSymbol, setActiveSymbol] = useState('SPY')
  const [activeTimeframe, setActiveTimeframe] = useState('1H')
  const [activeChart, setActiveChart] = useState<ChartMode>('candles')
  const [indicators, setIndicators] = useState<IndicatorState>({
    volume: true,
    rsi: true,
    macd: true,
    ema: true,
    sma: false,
    bollinger: true,
    volumeProfile: false,
  })

  const { data: quoteData } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    staleTime: 10_000,
  })

  const { data: activeSignal } = useQuery({
    queryKey: ['signal', activeSymbol, activeTimeframe],
    queryFn: () => api.signal(activeSymbol, activeTimeframe),
    refetchInterval: 10_000,
  })

  const { data: activeOhlc } = useQuery({
    queryKey: ['ohlc', activeSymbol, activeTimeframe],
    queryFn: () => api.ohlc(activeSymbol, activeTimeframe),
    staleTime: 5_000,
    refetchInterval: 15_000,
  })

  const activeQuote = useMemo(() => quoteData?.find((item) => item.symbol === activeSymbol), [activeSymbol, quoteData])
  const latestBar = activeOhlc?.points?.[activeOhlc.points.length - 1]
  const statBar = latestBar
    ? {
        open: latestBar.o,
        high: latestBar.h,
        low: latestBar.l,
        volume: latestBar.v,
      }
    : null

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="font-mono font-bold text-primary">{activeSymbol}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">${activeQuote ? activeQuote.price.toFixed(2) : '—'}</span>
                <span className={cn('text-sm font-mono', (activeQuote?.change ?? 0) >= 0 ? 'text-success' : 'text-destructive')}>
                  {(activeQuote?.change ?? 0) >= 0 ? '+' : ''}{(activeQuote?.change ?? 0).toFixed(2)}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Live market data • {activeTimeframe} • {activeChart}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 overflow-x-auto max-w-full">
            {symbolUniverse.map((symbol) => (
              <motion.button
                key={symbol}
                onClick={() => setActiveSymbol(symbol)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  symbol === activeSymbol ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {symbol}
              </motion.button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50">
            {timeframes.map((tf) => (
              <motion.button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tf === activeTimeframe
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf}
              </motion.button>
            ))}
          </div>

          {/* Chart Type */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50">
            <motion.button
              onClick={() => setActiveChart('candles')}
              whileHover={{ scale: 1.05 }}
              className={cn("p-2 rounded-lg", activeChart === 'candles' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <BarChart2 className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setActiveChart('line')}
              whileHover={{ scale: 1.05 }}
              className={cn("p-2 rounded-lg", activeChart === 'line' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Activity className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setActiveChart('bar')}
              whileHover={{ scale: 1.05 }}
              className={cn("p-2 rounded-lg", activeChart === 'bar' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Layers className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Chart */}
        <div className="xl:col-span-3 space-y-4">
          <GlassPanel
            glow="amber"
            delay={0.1}
            className="relative"
          >
            {/* Indicator toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ['volume', 'Volume', Waves],
                  ['rsi', 'RSI', Flame],
                  ['macd', 'MACD', Activity],
                  ['ema', 'EMA', TrendingUp],
                  ['sma', 'SMA', BarChart2],
                  ['bollinger', 'BB', Target],
                  ['volumeProfile', 'VP', Layers],
                ] as [string, string, ComponentType<{ className?: string }>][]).map(([key, label, Icon], i) => {
                  const active = indicators[key as keyof IndicatorState]
                  return (
                    <motion.button
                      key={label as string}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setIndicators((current) => ({ ...current, [key as keyof IndicatorState]: !current[key as keyof IndicatorState] }))}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                        active ? 'bg-accent/20 text-accent border-accent/30' : 'text-muted-foreground hover:bg-secondary border-transparent'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </motion.button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{activeSymbol} • data refreshes with timeframe changes</span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="p-4 h-[500px]">
              <TradingChart
                symbol={activeSymbol}
                timeframe={activeTimeframe}
                chartMode={activeChart}
                indicators={indicators}
              />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 text-xs text-muted-foreground">
              <span>Mode: {activeChart} | Timeframe: {activeTimeframe}</span>
              <span>
                {activeSignal
                  ? `${activeSignal.provider === 'fallback' ? 'Estimated' : 'Live'} signal refreshed • ${activeSignal.symbol}`
                  : activeQuote
                    ? `Provider quotes refreshed • ${activeQuote.symbol}`
                    : 'Loading live quote...'}
              </span>
            </div>

            {/* AI Overlay Indicators */}
            <div className="absolute top-20 right-8 space-y-2">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/20 border border-success/30"
              >
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-xs font-medium text-success">
                  Support: ${activeSignal?.support?.toFixed(2) ?? '—'}
                  {activeSignal?.provider === 'fallback' ? ' (estimated)' : ''}
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30"
              >
                <Target className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Target: ${activeSignal?.target_up?.toFixed(2) ?? '—'}
                  {activeSignal?.provider === 'fallback' ? ' (estimated)' : ''}
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30"
              >
                <Zap className="w-3 h-3 text-accent" />
                <span className="text-xs font-medium text-accent">
                  AI Signal: {activeSignal?.signal ?? 'HOLD'}
                  {activeSignal?.provider === 'fallback' ? ' (estimated)' : ''}
                </span>
              </motion.div>
            </div>
          </GlassPanel>

          {/* Market Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Open', value: statBar ? `$${statBar.open.toFixed(2)}` : '—', change: null },
              { label: 'High', value: statBar ? `$${statBar.high.toFixed(2)}` : '—', change: activeSignal ? `${activeSignal.volatility > 0 ? '+' : ''}${(activeSignal.volatility * 100).toFixed(2)}%` : null },
              { label: 'Low', value: statBar ? `$${statBar.low.toFixed(2)}` : '—', change: activeSignal ? `${activeSignal.trend === 'up' ? '+' : ''}${(activeSignal.momentum * 100).toFixed(2)}%` : null },
              { label: 'Volume', value: statBar ? `${(statBar.volume / 1_000_000).toFixed(1)}M` : '—', change: activeSignal?.provider === 'fallback' ? 'estimated' : 'live' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="p-4 rounded-xl glass"
              >
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-mono font-semibold">{stat.value}</span>
                  {stat.change && (
                    <span className={cn(
                      "text-xs font-mono",
                      stat.change.startsWith('+') ? 'text-success' : 'text-destructive'
                    )}>
                      {stat.change}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Order Book */}
          <GlassPanel 
            title="Order Book" 
            subtitle="Market depth"
            glow="blue" 
            delay={0.2}
          >
            <div className="h-[300px]">
              <OrderBook symbol={activeSymbol} />
            </div>
          </GlassPanel>

          {/* Watchlist */}
          <GlassPanel 
            title="Watchlist" 
            subtitle="Your tracked assets"
            delay={0.3}
          >
            <Watchlist />
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
