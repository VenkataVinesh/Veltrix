'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  Activity,
  Radio,
  Eye,
} from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

export function SignalsView() {
  const { data: liveSignals } = useQuery({
    queryKey: ['signals', 'market'],
    queryFn: () => api.signals(undefined, '1D'),
    refetchInterval: 10_000,
  })

  const signals = (liveSignals ?? []).map((signal) => ({
    symbol: signal.symbol,
    direction: signal.signal === 'BUY' ? 'long' : signal.signal === 'SELL' ? 'short' : 'neutral',
    confidence: Math.round(Number(signal.confidence) * 100),
    entry: signal.support,
    target: signal.target_up,
    stop: signal.target_down,
    timeframe: '1D',
    reason: `${signal.trend.toUpperCase()} trend | momentum ${signal.momentum.toFixed(2)} | volatility ${(signal.volatility * 100).toFixed(2)}%`,
    provider: signal.provider,
    bullishProbability: Math.round((signal.bullish_probability ?? 0.5) * 100),
    bearishProbability: Math.round((signal.bearish_probability ?? 0.5) * 100),
    neutralProbability: Math.round((signal.neutral_probability ?? 0.0) * 100),
    stopPrice: signal.stop_price ?? signal.target_down,
    volatilityExpectation: signal.volatility_expectation ?? (signal.volatility * 100),
    modelVersion: signal.model_version ?? 'technical-only',
  }))

  const longCount = signals.filter((signal) => signal.direction === 'long').length
  const shortCount = signals.filter((signal) => signal.direction === 'short').length
  const neutralCount = signals.filter((signal) => signal.direction === 'neutral').length

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 glow-amber">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Signal Intelligence</h1>
            <p className="text-sm text-muted-foreground">Signals derived from technical analysis and provider-backed market data</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/30">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-medium text-success">Live Scanning</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Signals', value: `${signals.length}`, icon: Zap, color: 'amber' },
          { label: 'Long Bias', value: `${signals.length ? Math.round((longCount / signals.length) * 100) : 0}%`, icon: Target, color: 'green' },
          { label: 'Short Bias', value: `${signals.length ? Math.round((shortCount / signals.length) * 100) : 0}%`, icon: BarChart3, color: 'blue' },
          { label: 'Neutral', value: `${neutralCount}`, icon: Activity, color: 'amber' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl glass"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className={cn(
                'w-4 h-4',
                stat.color === 'amber' && 'text-primary',
                stat.color === 'green' && 'text-success',
                stat.color === 'blue' && 'text-accent',
              )} />
            </div>
            <span className="text-2xl font-bold font-mono">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Signal Queue
          </h2>

          {signals.map((signal, index) => (
            <motion.div
              key={signal.symbol}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.01, x: 4 }}
              className={cn(
                'p-5 rounded-2xl glass border cursor-pointer transition-all',
                signal.direction === 'long' ? 'border-success/20 hover:border-success/40' : signal.direction === 'short' ? 'border-destructive/20 hover:border-destructive/40' : 'border-primary/20 hover:border-primary/40',
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    signal.direction === 'long' && 'bg-success/10',
                    signal.direction === 'short' && 'bg-destructive/10',
                    signal.direction === 'neutral' && 'bg-primary/10',
                  )}>
                    {signal.direction === 'long' ? (
                      <TrendingUp className="w-6 h-6 text-success" />
                    ) : signal.direction === 'short' ? (
                      <TrendingDown className="w-6 h-6 text-destructive" />
                    ) : (
                      <Eye className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-mono">{signal.symbol}</span>
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded',
                        signal.direction === 'long' ? 'bg-success/20 text-success' : signal.direction === 'short' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary',
                      )}>
                        {signal.direction.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{signal.timeframe} timeframe • {signal.provider === 'fallback' ? 'estimated' : 'live'} data</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-primary">{signal.confidence}%</div>
                  <span className="text-xs text-muted-foreground">confidence</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-secondary/50">
                  <span className="text-xs text-muted-foreground">Support</span>
                  <div className="font-mono font-semibold">${(signal.entry ?? 0).toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <span className="text-xs text-success">Target</span>
                  <div className="font-mono font-semibold text-success">${signal.target?.toFixed(2) ?? '—'}</div>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10">
                  <span className="text-xs text-destructive">Downside</span>
                  <div className="font-mono font-semibold text-destructive">${signal.stop?.toFixed(2) ?? '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-[11px] text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1">Bull {signal.bullishProbability}%</div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1">Bear {signal.bearishProbability}%</div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1">Flat {signal.neutralProbability}%</div>
              </div>

              <p className="text-sm text-muted-foreground">
                {signal.reason} • {signal.modelVersion} • vol exp {signal.volatilityExpectation.toFixed(2)}%
              </p>

              <div className="mt-2 text-xs text-muted-foreground">
                Stop ${signal.stopPrice?.toFixed(2) ?? '—'}
              </div>

              <div className="mt-4 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    signal.direction === 'long' ? 'bg-success' : signal.direction === 'short' ? 'bg-destructive' : 'bg-primary',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${signal.confidence}%` }}
                  transition={{ duration: 1, delay: 0.3 + index * 0.1 }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <GlassPanel
            title="Signal Quality"
            subtitle="Calculated from technical convergence"
            glow="amber"
            delay={0.4}
          >
            <div className="p-4 space-y-3">
              {signals.slice(0, 5).map((signal, i) => (
                <motion.div
                  key={`${signal.symbol}-${i}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    signal.direction === 'long' && 'bg-success/10 text-success',
                    signal.direction === 'short' && 'bg-destructive/10 text-destructive',
                    signal.direction === 'neutral' && 'bg-primary/10 text-primary',
                  )}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{signal.symbol}</span>
                      <span className="font-mono text-xs text-primary">{signal.provider === 'fallback' ? 'estimated' : 'live'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{signal.reason}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel
            title="Market Bias"
            subtitle="Across live signal set"
            glow="blue"
            delay={0.5}
          >
            <div className="p-4 space-y-3">
              {[
                { label: 'Long', value: longCount },
                { label: 'Neutral', value: neutralCount },
                { label: 'Short', value: shortCount },
              ].map((item, i) => {
                const percentage = signals.length ? Math.round((item.value / signals.length) * 100) : 0
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <span className={cn(
                        'text-xs font-mono',
                        item.label === 'Long' && 'text-success',
                        item.label === 'Short' && 'text-destructive',
                        item.label === 'Neutral' && 'text-primary',
                      )}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          item.label === 'Long' && 'bg-success',
                          item.label === 'Short' && 'bg-destructive',
                          item.label === 'Neutral' && 'bg-primary',
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: 0.7 + i * 0.1 }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
