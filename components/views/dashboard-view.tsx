'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  TrendingUp,
  Activity,
  Zap,
  Cpu,
} from 'lucide-react'
import { MetricCard } from '@/components/metric-card'
import { GlassPanel } from '@/components/glass-panel'
import { LiveTicker } from '@/components/live-ticker'
import { MiniChart } from '@/components/mini-chart'
import { MarketHeatmap } from '@/components/market-heatmap'
import { AIConfidence } from '@/components/ai-confidence'
import { InstitutionalFlow } from '@/components/institutional-flow'
import { api } from '@/lib/api-client'

export function DashboardView() {
  const { data: quotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    refetchInterval: 8000,
  })
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.portfolio,
    refetchInterval: 15_000,
  })
  const { data: signals } = useQuery({
    queryKey: ['signals', 'dashboard'],
    queryFn: () => api.signals(undefined, '1D'),
    refetchInterval: 10_000,
  })
  const { data: spySignal } = useQuery({
    queryKey: ['signal', 'SPY', '1D'],
    queryFn: () => api.signal('SPY', '1D'),
    refetchInterval: 10_000,
  })

  const bullishCount = (signals ?? []).filter((signal) => signal.signal === 'BUY').length
  const bearishCount = (signals ?? []).filter((signal) => signal.signal === 'SELL').length
  const activeSignalCount = (signals ?? []).filter((signal) => signal.signal !== 'HOLD').length
  const totalSignals = Math.max(1, signals?.length ?? 0)
  const bullishRatio = Math.round((bullishCount / totalSignals) * 100)
  const bearishRatio = Math.round((bearishCount / totalSignals) * 100)
  const dashboardSignal = spySignal?.signal === 'BUY' ? 'bullish' : spySignal?.signal === 'SELL' ? 'bearish' : 'neutral'

  return (
    <div className="space-y-6">
      <LiveTicker />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Portfolio Value"
          value={`$${(portfolio?.equity ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          change={portfolio?.daily_pnl ?? 0}
          changeLabel="vs last month"
          icon={<DollarSign className="w-5 h-5" />}
          trend={(portfolio?.daily_pnl ?? 0) >= 0 ? 'up' : 'down'}
          glowColor="amber"
          size="lg"
          delay={0}
        />
        <MetricCard
          title="Daily P&L"
          value={`${(portfolio?.daily_pnl ?? 0) >= 0 ? '+' : ''}$${Math.abs(portfolio?.daily_pnl ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          change={portfolio?.daily_pnl ?? 0}
          changeLabel="today"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={(portfolio?.daily_pnl ?? 0) >= 0 ? 'up' : 'down'}
          glowColor="green"
          size="lg"
          delay={0.1}
        />
        <MetricCard
          title="Active Positions"
          value={`${portfolio?.positions ?? 0}`}
          change={activeSignalCount}
          changeLabel="live signals"
          icon={<Activity className="w-5 h-5" />}
          trend="up"
          glowColor="blue"
          size="lg"
          delay={0.2}
        />
        <MetricCard
          title="AI Signals"
          value={`${signals?.length ?? 0}`}
          change={activeSignalCount}
          changeLabel="high confidence"
          icon={<Zap className="w-5 h-5" />}
          trend="up"
          glowColor="amber"
          size="lg"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GlassPanel
            title="AI Intelligence Core"
            subtitle="Real-time neural market analysis"
            glow="amber"
            delay={0.4}
          >
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <AIConfidence
                signal={dashboardSignal}
                confidence={spySignal ? Math.round(spySignal.confidence * 100) : 0}
                reasoning={spySignal
                  ? `Signal derived from ${spySignal.provider === 'fallback' ? 'estimated' : 'live'} technical analysis. Support ${spySignal.support.toFixed(2)}, resistance ${spySignal.resistance.toFixed(2)}, target ${spySignal.target_up.toFixed(2)}.`
                  : 'Loading live signal analysis...'}
              />
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 rounded-xl bg-secondary/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Neural Consensus</span>
                    <div className="flex items-center gap-1">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary">{signals?.length ?? 0} signals</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-success">Bullish</span>
                        <span className="font-mono">{bullishRatio}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full bg-success rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${bullishRatio}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-destructive">Bearish</span>
                        <span className="font-mono">{bearishRatio}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full bg-destructive rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${bearishRatio}%` }}
                          transition={{ duration: 1, delay: 0.7 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="p-4 rounded-xl bg-secondary/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Volatility Index</span>
                    <span className="text-lg font-bold font-mono text-primary">
                      {spySignal ? (spySignal.volatility * 100).toFixed(2) : '—'}
                    </span>
                  </div>
                  <MiniChart symbol="SPY" timeframe="1D" color="amber" height={50} width={200} />
                </motion.div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel
            title="Market Heatmap"
            subtitle="Sector performance overview"
            glow="blue"
            delay={0.5}
            headerAction={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">S&P 500</span>
                <span className="text-xs font-mono text-success">+1.24%</span>
              </div>
            }
          >
            <MarketHeatmap />
          </GlassPanel>
        </div>

        <div className="space-y-6">
          <GlassPanel
            title="Institutional Flow"
            subtitle="Smart money tracker"
            glow="green"
            delay={0.6}
          >
            <InstitutionalFlow />
          </GlassPanel>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="Sharpe Ratio"
              value={portfolio?.positions ? (portfolio.positions > 0 ? `${((portfolio.daily_pnl / Math.max(1, portfolio.positions)) * 0.01).toFixed(2)}` : '—') : '—'}
              trend="neutral"
              glowColor="blue"
              size="sm"
              delay={0.7}
            />
            <MetricCard
              title="Win Rate"
              value={signals?.length ? `${bullishRatio}%` : '—'}
              trend={bullishRatio >= 50 ? 'up' : 'down'}
              glowColor="green"
              size="sm"
              delay={0.8}
            />
            <MetricCard
              title="Max Drawdown"
              value="—"
              trend="neutral"
              glowColor="red"
              size="sm"
              delay={0.9}
            />
            <MetricCard
              title="Alpha"
              value="—"
              trend="neutral"
              glowColor="amber"
              size="sm"
              delay={1}
            />
          </div>

          <GlassPanel title="Market Overview" delay={1.1}>
            <div className="p-4 space-y-4">
              {(quotes ?? []).map((item, index) => (
                <motion.div
                  key={item.symbol}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + index * 0.1 }}
                  className="relative flex items-center justify-between p-3 rounded-xl hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <Link href={`/stocks/${item.symbol}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${item.symbol} details`} />
                  <div className="relative z-10">
                    <div className="font-mono font-semibold text-sm">{item.symbol}</div>
                    <div className="text-xs text-muted-foreground">{item.provider ? item.provider : 'Live feed'}</div>
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <MiniChart symbol={item.symbol} timeframe="1D" color={item.change >= 0 ? 'green' : 'red'} height={30} width={60} />
                    <div className="text-right">
                      <div className="font-mono text-sm">${item.price.toFixed(2)}</div>
                      <div className={`text-xs font-mono ${item.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
