'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Activity, Zap, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api-client'

const fmt = (v: unknown, dec = 2) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(dec) : '—' }
const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—' }
const $$ = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—' }

function Card({ children, p = 'p-5' }: { children: React.ReactNode; p?: string }) {
  return <div className={`premium-card ${p}`}>{children}</div>
}

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} style={{ background: color }} />
    </div>
  )
}

export function RiskView() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['risk'], queryFn: api.risk, refetchInterval: 30_000, staleTime: 20_000 })

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
  if (isError) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-600">Risk engine unavailable — portfolio needed.</p></div>

  const stress = data?.stress_tests ?? []
  const scenarios = data?.scenario_engine ?? []
  const equity = data?.equity ?? 0
  const varVal = Math.abs(data?.var ?? 0)
  const esVal = Math.abs(data?.expected_shortfall ?? 0)
  const dd = Math.abs(data?.max_drawdown ?? 0)
  const concRisk = data?.concentration_risk ?? 0
  const liqRisk = data?.liquidity_risk ?? 0

  return (
    <div className="space-y-5 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-white">Risk Engine</h2>
        <p className="text-xs text-gray-600 mt-0.5">VaR, stress tests & scenario analysis</p>
      </motion.div>

      {/* Key risk metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Value at Risk (95%)', value: $$(varVal), sub: pct(varVal / Math.max(equity, 1)), color: '#ef4444', icon: AlertTriangle },
          { label: 'Expected Shortfall', value: $$(esVal), sub: pct(esVal / Math.max(equity, 1)), color: '#f97316', icon: TrendingDown },
          { label: 'Max Drawdown', value: pct(dd), sub: `Portfolio loss`, color: '#eab308', icon: Activity },
          { label: 'Portfolio Equity', value: $$(equity), sub: 'Current value', color: '#10b981', icon: Shield },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <div className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: m.color, opacity: 0.6 }} />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-600">{m.label}</span>
                  <m.icon className="w-4 h-4" style={{ color: m.color }} />
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                <div className="text-xs text-gray-600 mt-1">{m.sub}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk gauges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Risk Exposure</h3>
            {[
              { label: 'Concentration Risk', value: concRisk, max: 1, color: '#f59e0b' },
              { label: 'Liquidity Risk', value: liqRisk, max: 1, color: '#ef4444' },
              { label: 'VaR / Equity', value: varVal / Math.max(equity, 1), max: 0.2, color: '#f97316' },
              { label: 'Max Drawdown', value: dd, max: 1, color: '#eab308' },
            ].map(g => (
              <div key={g.label} className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">{g.label}</span>
                  <span className="text-gray-400 font-mono">{(g.value * 100).toFixed(1)}%</span>
                </div>
                <GaugeBar value={g.value} max={g.max} color={g.color} />
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Stress tests */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Stress Tests</h3>
            {stress.length === 0 ? (
              <p className="text-xs text-gray-600">No stress test data</p>
            ) : stress.map((s, i) => (
              <motion.div key={s.metric} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-gray-500">{s.metric}</span>
                <span className={`text-sm font-mono font-semibold ${Number(s.value) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Number(s.value) < 0 ? '-' : '+'}{Math.abs(Number(s.value)).toFixed(2)}%
                </span>
              </motion.div>
            ))}
          </Card>
        </motion.div>
      </div>

      {/* Scenario engine */}
      {scenarios.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Scenario Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenarios.map((s, i) => {
                const isDown = (s.projected_pnl ?? 0) < 0
                return (
                  <motion.div key={s.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
                    className="rounded-xl p-4" style={{ background: isDown ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)', border: `1px solid ${isDown ? '#ef444430' : '#10b98130'}` }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: isDown ? '#ef4444' : '#10b981' }}>{s.name}</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between"><span>Shock</span><span className="font-mono text-gray-400">{s.shock_pct?.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span>Portfolio</span><span className="font-mono text-gray-400">{$$(s.projected_value)}</span></div>
                      <div className="flex justify-between"><span>P&L</span><span className={`font-mono font-semibold ${isDown ? 'text-red-400' : 'text-emerald-400'}`}>{isDown ? '-' : '+'}{$$( Math.abs(s.projected_pnl ?? 0))}</span></div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
