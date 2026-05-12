'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  TrendingUp,
  Cpu,
  Layers,
  Activity,
  Target,
  LineChart,
  BarChart3,
  AlertCircle,
} from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { MiniChart } from '@/components/mini-chart'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

const forecastSymbols = ['SPY', 'QQQ', 'AAPL', 'NVDA']

interface ForecastItem {
  symbol: string
  horizon: string
  current_price: number
  forecast_price: number
  target_up: number
  target_down: number
  support: number
  resistance: number
  confidence: number
  expected_return_pct: number
  volatility_pct: number
  signal: string
  signal_source: string
  signal_confidence: number
  timestamp: string
  source: string
}

export function ForecastView() {
  const { data: forecastData, isLoading, isError } = useQuery({
    queryKey: ['forecasts', forecastSymbols.join(',')],
    queryFn: () => api.forecasts(forecastSymbols.join(','), '1d,7d,30d'),
    refetchInterval: 10_000,
    retry: false,
  })

  const { data: history } = useQuery({
    queryKey: ['ohlc', 'SPY', '1D'],
    queryFn: () => api.ohlc('SPY', '1D'),
    refetchInterval: 15_000,
    retry: false,
  })

  const forecastItems = (forecastData?.items ?? []) as ForecastItem[]
  const forecastBySymbol = new Map(forecastItems.map((item) => [`${item.symbol}:${item.horizon}`, item]))
  const dailyForecastBySymbol = new Map(
    forecastItems
      .filter((item) => item.horizon === '1d')
      .map((item) => [item.symbol, item])
  )
  const historicalCloses = history?.points?.map((point) => point.c) ?? []

  const activeSymbols = forecastData?.summary.symbols ?? 0
  const totalForecasts = forecastData?.summary.forecasts ?? 0

  const firstForecast = dailyForecastBySymbol.get('SPY')
  const chartSeries = historicalCloses.slice(-48)
  const chartMin = chartSeries.length
    ? Math.min(...chartSeries, firstForecast?.support ?? Number.POSITIVE_INFINITY, firstForecast?.target_down ?? Number.POSITIVE_INFINITY)
    : firstForecast
      ? Math.min(firstForecast.support, firstForecast.target_down, firstForecast.current_price, firstForecast.forecast_price)
      : 0
  const chartMax = chartSeries.length
    ? Math.max(...chartSeries, firstForecast?.target_up ?? Number.NEGATIVE_INFINITY, firstForecast?.resistance ?? Number.NEGATIVE_INFINITY)
    : firstForecast
      ? Math.max(firstForecast.target_up, firstForecast.resistance, firstForecast.current_price, firstForecast.forecast_price)
      : 1
  const scaleX = (index: number) => (index / Math.max(chartSeries.length - 1, 1)) * 400
  const scaleY = (value: number) => 150 - ((value - chartMin) / Math.max(chartMax - chartMin, 1)) * 130
  const historicalPath = chartSeries.length
    ? chartSeries.map((value, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(index)} ${scaleY(value)}`).join(' ')
    : ''
  const targetPath = firstForecast
    ? `M ${scaleX(Math.max(chartSeries.length - 1, 0))} ${scaleY(firstForecast.current_price)} L 400 ${scaleY(firstForecast.forecast_price)}`
    : ''

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-accent/10 glow-blue">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Forecast Engine</h1>
            <p className="text-sm text-muted-foreground">Live model outputs from trend, volatility, and signal context</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/50">
            <Cpu className="w-4 h-4 text-primary" />
            <span className="text-sm">{activeSymbols} symbols active</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/30">
            <Activity className="w-4 h-4 text-success animate-pulse" />
            <span className="text-sm text-success">{totalForecasts} live forecasts</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {forecastSymbols.map((symbol, i) => {
          const signal = dailyForecastBySymbol.get(symbol)
          const direction = signal?.signal === 'BUY' ? 'bullish' : signal?.signal === 'SELL' ? 'bearish' : 'neutral'
          return (
            <motion.div
              key={symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="p-5 rounded-2xl glass border border-accent/20 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Layers className="w-5 h-5 text-accent" />
                </div>
                <span className={cn(
                  'text-xs font-bold px-2 py-1 rounded',
                  direction === 'bullish' && 'bg-success/20 text-success',
                  direction === 'neutral' && 'bg-primary/20 text-primary',
                  direction === 'bearish' && 'bg-destructive/20 text-destructive',
                )}>
                  {signal?.signal ?? 'HOLD'}
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-1">{symbol}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono">{signal ? `${Math.round(signal.confidence * 100)}%` : '—'}</span>
                <span className="text-xs text-muted-foreground">confidence</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    direction === 'bullish' && 'bg-success',
                    direction === 'neutral' && 'bg-primary',
                    direction === 'bearish' && 'bg-destructive',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${signal ? Math.round(signal.confidence * 100) : 0}%` }}
                  transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive/80 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Live forecast data is temporarily unavailable.
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <GlassPanel
            title="Price Forecast Visualization"
            subtitle="Historical close series and target bands derived from live forecast model"
            glow="amber"
            delay={0.3}
          >
            <div className="p-5">
              <div className="relative h-[350px] mb-6">
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                  {[...Array(16)].map((_, index) => (
                    <div key={index} className="border-b border-r border-border/20" />
                  ))}
                </div>

                <svg viewBox="0 0 400 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="coneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="historicalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {historicalPath ? (
                    <motion.path
                      d={historicalPath}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5 }}
                    />
                  ) : null}

                  {firstForecast ? (
                    <>
                      <motion.path
                        d={`M ${scaleX(Math.max(chartSeries.length - 1, 0))} ${scaleY(firstForecast.current_price)} L 400 ${scaleY(firstForecast.target_up)} L 400 ${scaleY(firstForecast.target_down)} Z`}
                        fill="url(#coneGradient)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                      />
                      <motion.path
                        d={targetPath}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                      />
                      <motion.path
                        d={`M ${scaleX(Math.max(chartSeries.length - 1, 0))} ${scaleY(firstForecast.support)} L 400 ${scaleY(firstForecast.support)}`}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 1.2, duration: 0.8 }}
                      />
                      <motion.path
                        d={`M ${scaleX(Math.max(chartSeries.length - 1, 0))} ${scaleY(firstForecast.resistance)} L 400 ${scaleY(firstForecast.resistance)}`}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 1.2, duration: 0.8 }}
                      />
                      <motion.circle
                        cx={scaleX(Math.max(chartSeries.length - 1, 0))}
                        cy={scaleY(firstForecast.current_price)}
                        r="6"
                        fill="#f59e0b"
                        initial={{ scale: 0 }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ delay: 1.3, duration: 2, repeat: Infinity }}
                      />
                    </>
                  ) : null}
                </svg>

                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                  <span>-30d</span>
                  <span>Now</span>
                  <span>+7d</span>
                  <span>+30d</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <span className="text-xs text-muted-foreground">Historical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Predicted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-3 bg-gradient-to-r from-accent/30 to-success/10 rounded" />
                  <span className="text-xs text-muted-foreground">Confidence Cone</span>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel
          title="Price Targets"
          subtitle="Model-derived forecast bands"
          glow="green"
          delay={0.4}
        >
          <div className="p-4 space-y-4">
            {forecastSymbols.map((symbol, i) => {
              const signal = dailyForecastBySymbol.get(symbol)
              return (
                <motion.div
                  key={symbol}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{symbol}</span>
                      <TrendingUp className="w-4 h-4 text-success" />
                    </div>
                    <span className="text-xs text-muted-foreground">{signal ? Math.round(signal.confidence * 100) : 0}% conf.</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-1">Support</span>
                      <span className="font-mono">${signal ? signal.support.toFixed(2) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Target</span>
                      <span className="font-mono text-success">${signal ? signal.target_up.toFixed(2) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Stop</span>
                      <span className="font-mono text-destructive">${signal ? signal.target_down.toFixed(2) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Vol.</span>
                      <span className="font-mono">{signal ? `${signal.volatility_pct.toFixed(2)}%` : '—'}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <MiniChart
                      color={signal?.signal === 'SELL' ? 'red' : 'green'}
                      height={30}
                      width={200}
                      data={signal ? [signal.support, signal.current_price, signal.forecast_price, signal.target_up] : historicalCloses.length ? historicalCloses : undefined}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel
        title="Forecast Summary"
        subtitle={`Source: ${forecastData?.source ?? 'live-market-forecast'}`}
        glow="blue"
        delay={0.5}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LineChart className="h-4 w-4" />
              Expected Return
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              {firstForecast ? `${firstForecast.expected_return_pct >= 0 ? '+' : ''}${firstForecast.expected_return_pct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Confidence
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              {firstForecast ? `${Math.round(firstForecast.confidence * 100)}%` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              1D Direction
            </div>
            <div className="mt-2 text-2xl font-bold font-mono">
              {firstForecast?.signal ?? 'HOLD'}
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
