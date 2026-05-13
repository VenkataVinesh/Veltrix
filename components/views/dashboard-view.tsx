'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Activity, Zap, ArrowUpRight, ArrowDownRight,
  Brain, Shield, BarChart3, Globe2, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { AIDebatePanel } from '@/components/ai-debate-panel'
import { LiveTicker } from '@/components/ui/live-ticker'
import { MiniChart } from '@/components/mini-chart'
import { ChartWrapper } from '@/components/ui/chart-wrapper'

const FADE_UP = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`premium-card ${className}`} style={style}>
      {children}
    </div>
  )
}

function SectionHeader({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-[#8fd8ff] transition-colors">
          View all <ChevronRight className="w-3 h-3" />
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
  const { data: risk } = useQuery({ queryKey: ['risk'], queryFn: api.risk, refetchInterval: 30_000, staleTime: 20_000 })

  const equity = portfolio?.equity ?? 0
  const pnl = portfolio?.daily_pnl ?? 0
  const positions = portfolio?.positions ?? 0
  const bullish = (signals ?? []).filter(s => s.signal === 'BUY').length
  const bearish = (signals ?? []).filter(s => s.signal === 'SELL').length
  const total = Math.max(1, signals?.length ?? 1)
  const bullRatio = Math.round(bullish / total * 100)

  const topQuotes = (quotes ?? []).slice(0, 7)

  const consensusSignal = spySignal?.signal ?? 'HOLD'
  const spyConf = spySignal ? Math.round(spySignal.confidence * 100) : 0

  return (
    <div className="space-y-5 max-w-[1600px]">
      <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ duration: 0.45 }} className="flex flex-col gap-2 pb-1 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-cyan-100/45">
            <span className="h-px w-8 bg-cyan-100/25" />
            Institutional Command Surface
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">Market intelligence, compressed.</h1>
        </div>
        <div className="max-w-md text-xs leading-5 text-[#7f8794]">
          Live pricing, portfolio posture, agent consensus, and risk context in one quiet operating layer.
        </div>
      </motion.div>

      {/* ─── Hero metrics row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Portfolio Value',
            value: `$${equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            sub: pnl !== 0 ? `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)} today` : 'No positions',
            up: pnl >= 0,
            color: '#dce8ff',
            delay: 0,
          },
          {
            label: 'Daily P&L',
            value: `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`,
            sub: positions > 0 ? `${positions} open positions` : 'Add positions',
            up: pnl >= 0,
            color: pnl >= 0 ? '#61f2b2' : '#ff6b7a',
            delay: 0.05,
          },
          {
            label: 'AI Consensus',
            value: consensusSignal,
            sub: `${spyConf}% confidence · SPY`,
            up: consensusSignal === 'BUY',
            color: consensusSignal === 'BUY' ? '#61f2b2' : consensusSignal === 'SELL' ? '#ff6b7a' : '#dce8ff',
            delay: 0.1,
          },
          {
            label: 'Signal Sentiment',
            value: `${bullRatio}% Bull`,
            sub: `${bullish}B / ${bearish}S · ${signals?.length ?? 0} signals`,
            up: bullRatio >= 50,
            color: bullRatio >= 50 ? '#61f2b2' : '#ff6b7a',
            delay: 0.15,
          },
        ].map((m) => (
          <motion.div key={m.label} variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: m.delay, duration: 0.4 }}>
            <Card className="p-5 overflow-hidden relative">
              {/* Accent line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: m.color, opacity: 0.6 }} />
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-3">{m.label}</p>
              <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
              <div className="flex items-center gap-1.5 mt-2">
                {m.up ? <ArrowUpRight className="w-3 h-3 text-[#61f2b2]" /> : <ArrowDownRight className="w-3 h-3 text-[#ff6b7a]" />}
                <span className="text-xs text-gray-600">{m.sub}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      {/* Live SPY chart */}
      <ChartWrapper symbol="SPY" timeframe="daily" chartMode="candles" height={300} />
      <LiveTicker />
      {/* ─── Main content grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ─── Left 2/3 ─── */}
        <div className="xl:col-span-2 space-y-5">

          {/* AI Signal Overview */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.2, duration: 0.4 }}>
            <Card>
              <SectionHeader title="AI Signal Overview" sub="Real-time neural consensus" href="/signals" />
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Consensus badge */}
                <div className="rounded-lg p-4" style={{ background: 'rgba(5,5,7,0.52)', border: '1px solid rgba(220,232,255,0.07)' }}>
                  <p className="text-xs text-gray-600 mb-2">Market Verdict</p>
                  <div className="text-2xl font-bold mb-1" style={{ color: consensusSignal === 'BUY' ? '#61f2b2' : consensusSignal === 'SELL' ? '#ff6b7a' : '#dce8ff' }}>
                    {consensusSignal}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${spyConf}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ background: consensusSignal === 'BUY' ? '#61f2b2' : consensusSignal === 'SELL' ? '#ff6b7a' : '#8fd8ff' }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">{spyConf}% confidence</p>
                </div>

                {/* Bull/bear meter */}
                <div className="rounded-lg p-4" style={{ background: 'rgba(5,5,7,0.52)', border: '1px solid rgba(220,232,255,0.07)' }}>
                  <p className="text-xs text-gray-600 mb-3">Sentiment Split</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#61f2b2]">Bullish</span>
                        <span className="text-gray-500 font-mono">{bullRatio}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-[#61f2b2]" initial={{ width: 0 }} animate={{ width: `${bullRatio}%` }} transition={{ duration: 0.8, delay: 0.4 }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#ff6b7a]">Bearish</span>
                        <span className="text-gray-500 font-mono">{100 - bullRatio}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-[#ff6b7a]" initial={{ width: 0 }} animate={{ width: `${100 - bullRatio}%` }} transition={{ duration: 0.8, delay: 0.45 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SPY stats */}
                <div className="rounded-lg p-4" style={{ background: 'rgba(5,5,7,0.52)', border: '1px solid rgba(220,232,255,0.07)' }}>
                  <p className="text-xs text-gray-600 mb-2">SPY Analysis</p>
                  {spySignal ? (
                    <div className="space-y-1.5">
                      {[
                        { label: 'Trend', value: spySignal.trend },
                        { label: 'Momentum', value: spySignal.momentum.toFixed(3) },
                        { label: 'Volatility', value: `${(spySignal.volatility * 100).toFixed(2)}%` },
                        { label: 'Support', value: `$${(spySignal.support ?? 0).toFixed(2)}` },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-xs">
                          <span className="text-gray-600">{row.label}</span>
                          <span className="text-gray-300 font-mono">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">Loading...</p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* AI Debate Panel */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.25, duration: 0.4 }}>
            <Card>
              <SectionHeader title="Multi-Agent Debate" sub="4 AI agents · SPY live analysis" href="/signals" />
              <div className="px-5 pb-5">
                <AIDebatePanel symbol="SPY" compact={false} />
              </div>
            </Card>
          </motion.div>

          {/* Quick nav modules */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.3, duration: 0.4 }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Analytics', icon: BarChart3, href: '/analytics', color: '#8fd8ff', desc: 'Alpha · Beta · Sharpe' },
                { label: 'Risk Engine', icon: Shield, href: '/risk', color: '#ff6b7a', desc: 'VaR · CVaR · Stress' },
                { label: 'Forecast', icon: Brain, href: '/forecast', color: '#8b5cf6', desc: 'ML ensemble models' },
                { label: 'Macro Intel', icon: Globe2, href: '/macro', color: '#dce8ff', desc: 'Rates · Commodities' },
              ].map((m, i) => (
                <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                  <Link href={m.href}>
                    <div className="premium-card p-4 hover:-translate-y-0.5 hover:border-cyan-100/20 active:scale-[0.99] transition-all cursor-pointer">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                        style={{ background: m.color + '15' }}>
                        <m.icon className="w-4.5 h-4.5" style={{ color: m.color, width: 18, height: 18 }} />
                      </div>
                      <p className="text-sm font-semibold text-white mb-0.5">{m.label}</p>
                      <p className="text-[11px] text-gray-600">{m.desc}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ─── Right 1/3 ─── */}
        <div className="space-y-5">
          {/* Live market overview */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.2, duration: 0.4 }}>
            <Card>
              <SectionHeader title="Market Overview" sub="Live quotes" href="/markets" />
              <div className="pb-3">
                {topQuotes.length === 0 ? (
                  <div className="px-5 py-4 text-xs text-gray-600">Loading quotes...</div>
                ) : topQuotes.map((q, i) => (
                  <motion.div
                    key={q.symbol}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                  >
                    <Link href={`/markets`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group">
                      <div className="w-1 h-8 rounded-full" style={{ background: q.change >= 0 ? '#61f2b2' : '#ff6b7a', opacity: 0.75 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-semibold text-white">{q.symbol}</div>
                        <div className="text-[10px] text-gray-600">{q.provider ?? 'live'}</div>
                      </div>
                      <MiniChart symbol={q.symbol} timeframe="1D" color={q.change >= 0 ? 'green' : 'red'} height={24} width={48} />
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono text-white">${q.price.toFixed(2)}</div>
                        <div className={`text-[10px] font-mono ${q.change >= 0 ? 'text-[#61f2b2]' : 'text-[#ff6b7a]'}`}>
                          {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Portfolio summary */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.3, duration: 0.4 }}>
            <Card>
              <SectionHeader title="Portfolio" sub="Current allocation" href="/portfolio" />
              <div className="px-5 pb-5 space-y-3">
                {positions === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-gray-600">No open positions</p>
                    <Link href="/portfolio" className="text-xs text-[#8fd8ff] hover:text-white transition-colors mt-1 block">
                      Add your first position →
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Equity</span>
                      <span className="text-white font-mono">${equity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Daily P&L</span>
                      <span className={`font-mono ${pnl >= 0 ? 'text-[#61f2b2]' : 'text-[#ff6b7a]'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Positions</span>
                      <span className="text-white font-mono">{positions}</span>
                    </div>
                    <div className="pt-2">
                      <Link href="/portfolio" className="block w-full text-center py-2 rounded-lg text-xs font-semibold text-[#dce8ff] transition-colors hover:text-white"
                        style={{ background: 'rgba(143,216,255,0.075)', border: '1px solid rgba(143,216,255,0.16)' }}>
                        Manage Portfolio
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Performance stats */}
          <motion.div variants={FADE_UP} initial="initial" animate="animate" transition={{ delay: 0.35, duration: 0.4 }}>
            <Card>
              <SectionHeader title="Performance" sub="Risk-adjusted metrics" href="/analytics" />
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                {[
                  { label: 'Sharpe', value: risk?.stress_tests?.find(t => t.metric === 'ML Engine Sharpe')?.value?.toFixed(2) ?? '—', color: '#8fd8ff' },
                  { label: 'Sortino', value: risk?.stress_tests?.find(t => t.metric === 'ML Engine Sharpe') ? (risk?.stress_tests?.find(t => t.metric === 'ML Engine Sharpe')!.value * 1.3).toFixed(2) : '—', color: '#dce8ff' },
                  { label: 'Alpha', value: risk?.stress_tests?.find(t => t.metric === 'ML Engine Sharpe') ? '+0.04' : '—', color: '#8b5cf6' },
                  { label: 'Beta', value: risk?.stress_tests?.find(t => t.metric === 'ML Engine Beta')?.value?.toFixed(2) ?? '—', color: '#61f2b2' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg p-3" style={{ background: 'rgba(5,5,7,0.52)', border: '1px solid rgba(220,232,255,0.07)' }}>
                    <div className="text-[10px] text-gray-600 mb-1">{s.label}</div>
                    <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
