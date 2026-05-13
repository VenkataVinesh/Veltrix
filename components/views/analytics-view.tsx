'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, BarChart3, Activity, Layers, Award } from 'lucide-react'
import { api } from '@/lib/api-client'

const fmt = (v: unknown, dec = 2) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(dec) : '—'
}
const pct = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%` : '—'
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`premium-card ${className}`}>
      {children}
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: color ?? '#e0e0ea' }}>{value}</span>
    </div>
  )
}

export function AnalyticsView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.analytics,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
  const { data: sectors } = useQuery({
    queryKey: ['sector-heatmap'],
    queryFn: api.getSectorHeatmap,
    staleTime: 60_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  if (isError) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-600">Analytics unavailable — add positions to your portfolio first.</p>
    </div>
  )

  const rolling = (data?.rolling_returns ?? []).slice(-20)
  const vol = (data?.rolling_volatility ?? []).slice(-20)
  const maxR = Math.max(...rolling.map(Math.abs), 0.01)
  const attribution = data?.performance_attribution ?? []
  const sectorExp = data?.sector_exposure ?? sectors?.map(s => ({ sector: s.name, weight: s.weight })) ?? []

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-white">Portfolio Analytics</h2>
        <p className="text-xs text-gray-600 mt-0.5">Risk-adjusted performance metrics</p>
      </motion.div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Return', value: pct(data?.total_return_pct), icon: TrendingUp, color: Number(data?.total_return_pct) >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Sharpe Ratio', value: fmt(data?.sharpe), icon: Award, color: '#f59e0b' },
          { label: 'Sortino', value: fmt(data?.sortino), icon: Activity, color: '#06b6d4' },
          { label: 'Alpha', value: pct(data?.alpha), icon: BarChart3, color: '#8b5cf6' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: m.color, opacity: 0.6 }} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-600">{m.label}</span>
                <m.icon className="w-4 h-4" style={{ color: m.color }} />
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Rolling returns chart */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Rolling Returns (20-period)</h3>
            <div className="flex items-end gap-1 h-28">
              {rolling.length === 0 ? (
                <p className="text-xs text-gray-600 m-auto">No return data yet</p>
              ) : rolling.map((r, i) => {
                const h = Math.abs(r) / maxR * 100
                const up = r >= 0
                return (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${Math.max(h, 2)}%`, background: up ? '#10b98155' : '#ef444455', alignSelf: up ? 'flex-end' : 'flex-start' }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + i * 0.015 }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-700 mt-2 font-mono">
              <span>20 periods ago</span><span>Now</span>
            </div>
          </Card>
        </motion.div>

        {/* Risk metrics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Risk Metrics</h3>
            <StatRow label="Beta" value={fmt(data?.beta)} />
            <StatRow label="Info Ratio" value={fmt(data?.information_ratio)} />
            <StatRow label="Rolling Vol" value={`${fmt(data?.rolling_volatility?.slice(-1)?.[0])}%`} color="#f59e0b" />
            <StatRow label="Total Equity" value={`$${Number(data?.total_equity || 0).toLocaleString()}`} color="#10b981" />
            <StatRow label="Invested" value={`$${Number(data?.total_invested || 0).toLocaleString()}`} />
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sector exposure */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Sector Exposure</h3>
            {sectorExp.length === 0 ? (
              <p className="text-xs text-gray-600">No sector data</p>
            ) : sectorExp.slice(0, 8).map((s, i) => {
              const COLORS = ['#f59e0b','#10b981','#06b6d4','#8b5cf6','#ef4444','#f97316','#ec4899','#84cc16']
              return (
                <div key={s.sector ?? i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{s.sector}</span>
                    <span className="text-gray-500 font-mono">{fmt(s.weight, 1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(s.weight ?? 0, 100)}%` }} transition={{ delay: 0.4 + i * 0.04, duration: 0.6 }} style={{ background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </Card>
        </motion.div>

        {/* Attribution table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Performance Attribution</h3>
            {attribution.length === 0 ? (
              <p className="text-xs text-gray-600">Add positions to see attribution</p>
            ) : (
              <div className="space-y-2">
                {attribution.slice(0, 6).map((a) => (
                  <div key={a.symbol} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#0a0a0f' }}>
                    <span className="text-xs font-mono font-bold text-white w-16">{a.symbol}</span>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.abs(a.weight ?? 0), 100)}%`, background: (a.pnl ?? 0) >= 0 ? '#10b981' : '#ef4444' }} />
                      </div>
                    </div>
                    <span className={`text-xs font-mono w-16 text-right ${(a.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pct(a.return_pct)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
