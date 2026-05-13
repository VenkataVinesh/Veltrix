'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Building2, TrendingUp, TrendingDown, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { api } from '@/lib/api-client'

function Card({ children, className = 'p-5' }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>
}

export function FlowView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['institutional-flow'],
    queryFn: () => api.getInstitutionalFlow(),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  })
  const { data: sectors } = useQuery({ queryKey: ['sector-heatmap'], queryFn: api.getSectorHeatmap, staleTime: 60_000, retry: false })

  const items = data?.items ?? []
  const summary = data?.summary
  const netFlow = summary?.net_flow ?? 0
  const buyFlow = summary?.buy_flow ?? 0
  const sellFlow = summary?.sell_flow ?? 0
  const maxNotional = Math.max(...items.map(i => i.notional ?? 0), 1)

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
  if (isError) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-600">Flow data unavailable — authentication required.</p></div>

  return (
    <div className="space-y-5 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-white">Institutional Flow</h2>
        <p className="text-xs text-gray-600 mt-0.5">Smart money tracking · Order flow intelligence</p>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Buy Flow', value: `$${(buyFlow / 1e6).toFixed(1)}M`, color: '#10b981' },
          { label: 'Net Flow', value: `${netFlow >= 0 ? '+' : ''}$${(netFlow / 1e6).toFixed(1)}M`, color: netFlow >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Sell Flow', value: `$${(sellFlow / 1e6).toFixed(1)}M`, color: '#ef4444' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <div className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: m.color, opacity: 0.6 }} />
                <p className="text-xs text-gray-600 mb-2">{m.label}</p>
                <div className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Flow cards */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-white px-1">Smart Money Activity</h3>
          {items.length === 0 ? (
            <Card><p className="text-xs text-gray-600">No flow data available</p></Card>
          ) : items.map((item, i) => {
            const isBuy = item.action === 'BUY'
            const flowPct = (item.notional / maxNotional) * 100
            return (
              <motion.div key={`${item.symbol}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Direction indicator */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isBuy ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      {isBuy ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold font-mono text-white">{item.symbol}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{item.action}</span>
                        <span className="text-[10px] text-gray-600 ml-auto">{item.source}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${flowPct}%` }} transition={{ delay: 0.3 + i * 0.04 }}
                          style={{ background: isBuy ? '#10b981' : '#ef4444' }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-bold" style={{ color: isBuy ? '#10b981' : '#ef4444' }}>{item.amount}</div>
                      <div className="text-[10px] text-gray-600">{(item.confidence * 100).toFixed(0)}% conf</div>
                      <div className={`text-[10px] font-mono ${(item.price_change_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(item.price_change_pct ?? 0) >= 0 ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Sector heatmap */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white px-1">Sector Rotation</h3>
          <Card className="p-4">
            {(sectors ?? []).slice(0, 10).map((s, i) => {
              const isPos = (s.change ?? 0) >= 0
              return (
                <motion.div key={s.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                  className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    {isPos ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                    <span className={`text-xs font-mono font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPos ? '+' : ''}{(s.change ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </Card>

          {/* Volume imbalance */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-white mb-3">Flow Pressure</h4>
            <div className="space-y-2">
              {items.slice(0, 5).map((item, i) => {
                const isBuy = item.action === 'BUY'
                const ratio = Math.min((item.volume_ratio ?? 1), 5) / 5 * 100
                return (
                  <div key={`pressure-${i}`}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-gray-600 font-mono">{item.symbol}</span>
                      <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>{item.volume_ratio?.toFixed(1)}x vol</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${ratio}%` }} transition={{ delay: 0.4 + i * 0.06 }}
                        style={{ background: isBuy ? '#10b981' : '#ef4444' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
