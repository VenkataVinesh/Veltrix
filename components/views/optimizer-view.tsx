'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { SlidersHorizontal, TrendingUp, Shield, Target, PieChart, Brain } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, Cell } from 'recharts'
import { GlassPanel } from '@/components/glass-panel'
import { MetricCard } from '@/components/metric-card'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

type OptimizerResult = {
  optimal_portfolio: Array<{ symbol: string; weight: number; notional: number; price: number; shares: number }>
  expected_return: number
  expected_volatility: number
  expected_sharpe: number
  efficient_frontier: Array<{ risk: number; return: number; sharpe: number }>
  growth_projection?: Array<{ year: number; value: number }>
  explanation?: { rationale?: string[]; macro_considerations?: string[] }
}

const SECTOR_OPTIONS = [
  'technology', 'healthcare', 'finance', 'energy', 'consumer',
  'industrials', 'utilities', 'real_estate', 'materials', 'communication',
]

const COLORS_CYCLE = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6']

const PIE_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#f97316']

export function OptimizerView() {
  const [amount, setAmount] = useState(50000)
  const [riskTolerance, setRiskTolerance] = useState('medium')
  const [horizon, setHorizon] = useState('long')
  const [volatilityTolerance, setVolatilityTolerance] = useState('medium')
  const [preferredSectors, setPreferredSectors] = useState<string[]>(['technology', 'healthcare'])
  const [dividendPreference, setDividendPreference] = useState(false)

  const optimizeMutation = useMutation({
    mutationFn: () => api.optimizer({
      amount,
      risk_tolerance: riskTolerance,
      horizon,
      preferred_sectors: preferredSectors,
      ethical: false,
      dividend_preference: dividendPreference,
      volatility_tolerance: volatilityTolerance,
    }),
  })

  const result = optimizeMutation.data as OptimizerResult | undefined

  const toggleSector = (sector: string) => {
    setPreferredSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/10 glow-amber">
          <SlidersHorizontal className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Portfolio Optimizer</h1>
          <p className="text-sm text-muted-foreground">Mean-variance optimization with sector constraints</p>
        </div>
      </motion.div>

      <GlassPanel title="Optimization Inputs" glow="amber">
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Investment amount</span>
            <input value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number" min={100} className="w-full rounded-xl bg-secondary/40 p-3 font-mono" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Risk tolerance</span>
            <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)} className="w-full rounded-xl bg-secondary/40 p-3">
              <option value="low">Low — Capital preservation</option>
              <option value="medium">Medium — Balanced</option>
              <option value="high">High — Aggressive growth</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Horizon</span>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className="w-full rounded-xl bg-secondary/40 p-3">
              <option value="short">Short-term (&lt;1 year)</option>
              <option value="medium">Medium-term (1-3 years)</option>
              <option value="long">Long-term (3+ years)</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Volatility tolerance</span>
            <select value={volatilityTolerance} onChange={(e) => setVolatilityTolerance(e.target.value)} className="w-full rounded-xl bg-secondary/40 p-3">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-muted-foreground mb-3">Preferred sectors (select up to 5)</p>
          <div className="flex flex-wrap gap-2">
            {SECTOR_OPTIONS.map((sector) => (
              <button
                key={sector}
                onClick={() => toggleSector(sector)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  preferredSectors.includes(sector)
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/50'
                )}
              >
                {sector.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={dividendPreference} onChange={(e) => setDividendPreference(e.target.checked)} className="rounded" />
            <span>Prefer dividend-paying assets</span>
          </label>
          <button
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
            className="ml-auto rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:bg-primary/90 transition-colors"
          >
            {optimizeMutation.isPending ? 'Running optimizer...' : 'Run Optimization'}
          </button>
        </div>
      </GlassPanel>

      {optimizeMutation.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive/80">
          Optimizer unavailable. Ensure backend is running and authenticated.
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Expected Return"
              value={`${(result.expected_return * 100).toFixed(2)}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              trend="up" glowColor="green" size="lg"
            />
            <MetricCard
              title="Expected Volatility"
              value={`${(result.expected_volatility * 100).toFixed(2)}%`}
              icon={<Shield className="w-5 h-5" />}
              trend={result.expected_volatility < 0.2 ? 'up' : 'down'}
              glowColor="blue" size="lg"
            />
            <MetricCard
              title="Sharpe Ratio"
              value={result.expected_sharpe.toFixed(3)}
              icon={<Target className="w-5 h-5" />}
              trend={result.expected_sharpe > 1 ? 'up' : 'down'}
              glowColor="amber" size="lg"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GlassPanel title="Efficient Frontier" subtitle="Risk-return frontier">
              <div className="h-72 p-4">
                {result.efficient_frontier.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.efficient_frontier.map((p) => ({ risk: (p.risk * 100).toFixed(2), return: (p.return * 100).toFixed(2), sharpe: p.sharpe.toFixed(3) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="risk" stroke="#8a8a9a" tick={{ fontSize: 10 }} label={{ value: 'Risk (%)', position: 'bottom', style: { fill: '#8a8a9a', fontSize: 10 } }} />
                      <YAxis stroke="#8a8a9a" tick={{ fontSize: 10 }} label={{ value: 'Return (%)', angle: -90, position: 'insideLeft', style: { fill: '#8a8a9a', fontSize: 10 } }} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`${value}%`, undefined]}
                      />
                      <Line type="monotone" dataKey="return" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Insufficient frontier data</div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel title="Portfolio Allocation" subtitle="Optimized asset weights">
              <div className="flex items-center justify-center h-72 p-4">
                {result.optimal_portfolio.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={result.optimal_portfolio.map((a, i) => ({ name: a.symbol, value: a.weight * 100, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={2}
                      >
                        {result.optimal_portfolio.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No allocation data</div>
                )}
              </div>
            </GlassPanel>
          </div>

          {result.growth_projection && result.growth_projection.length > 0 && (
            <GlassPanel title="Growth Projection" subtitle="Projected portfolio value over time">
              <div className="h-56 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.growth_projection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="year" stroke="#8a8a9a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#8a8a9a" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Value']}
                    />
                    <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          )}

          <GlassPanel title="Recommended Allocation" subtitle="Buy/sell breakdown" glow="green">
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {result.optimal_portfolio.map((item, index) => (
                <motion.article
                  key={item.symbol}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-xl border border-border/60 bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-semibold">{item.symbol}</span>
                    <span className="text-sm font-mono font-bold text-success">{(item.weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-3">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.weight * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span>Notional</span>
                      <div className="font-mono text-foreground">${item.notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <span>Shares</span>
                      <div className="font-mono text-foreground">{item.shares}</div>
                    </div>
                    <div>
                      <span>Price</span>
                      <div className="font-mono text-foreground">${item.price.toFixed(2)}</div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </GlassPanel>

          {result.explanation && (
            <GlassPanel title="Optimization Rationale" subtitle="Model reasoning" glow="blue">
              <div className="p-5 space-y-4">
                {result.explanation.rationale?.length ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" /> Rationale
                    </h4>
                    <ul className="space-y-2">
                      {result.explanation.rationale.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {result.explanation.macro_considerations?.length ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Macro considerations</h4>
                    <ul className="space-y-2">
                      {result.explanation.macro_considerations.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </GlassPanel>
          )}
        </>
      )}
    </div>
  )
}
