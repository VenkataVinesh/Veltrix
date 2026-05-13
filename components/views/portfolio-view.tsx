'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Briefcase, TrendingUp, TrendingDown, PieChart, Shield, Target, Activity, DollarSign, AlertCircle, Plus, Trash2, X, Check,
} from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { MiniChart } from '@/components/mini-chart'
import { FlashPrice } from '@/components/flash-price'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

export function PortfolioView() {
  const queryClient = useQueryClient()
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: api.portfolio,
    refetchInterval: 15_000,
  })

  const { data: liveQuotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    refetchInterval: 8_000,
  })

  const { data: portfolio } = useQuery({
    queryKey: ['portfolios'],
    queryFn: api.portfolios,
    enabled: !!summary && summary.positions > 0,
  })

  const portfolioId = portfolio?.[0]?.id

  const { data: positions } = useQuery({
    queryKey: ['positions', portfolioId],
    queryFn: () => api.getPositions(portfolioId!),
    enabled: !!portfolioId,
    refetchInterval: 15_000,
  })

  const addPositionMutation = useMutation({
    mutationFn: async () => {
      let pid = portfolioId
      if (!pid) {
        const p = await api.createPortfolio('My Portfolio')
        pid = p.id
      }
      return api.createPosition(pid, newSymbol.toUpperCase(), Number(newQuantity), Number(newPrice))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] })
      setShowAddPosition(false)
      setNewSymbol('')
      setNewQuantity('')
      setNewPrice('')
    },
  })

  const deletePositionMutation = useMutation({
    mutationFn: (positionId: number) => {
      if (!portfolioId) throw new Error('No portfolio')
      return api.deletePosition(portfolioId, positionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] })
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })

  const hasData = summary && summary.positions > 0
  const quoteMap = new Map((liveQuotes ?? []).map((q) => [q.symbol, q]))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full border border-primary/40 bg-primary/10" />
          <p className="text-sm text-muted-foreground">Loading portfolio data...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="font-medium text-foreground">Portfolio data unavailable</p>
          <p className="text-sm text-muted-foreground">Login and create positions to view portfolio analytics.</p>
        </div>
      </div>
    )
  }

  const calculatedEquity = positions?.reduce((acc, pos) => {
    const currentPrice = quoteMap.get(pos.symbol)?.price ?? pos.avg_price
    return acc + pos.quantity * currentPrice
  }, 0)

  const metrics = hasData ? [
    { label: 'Total Equity', value: `$${(calculatedEquity ?? summary!.equity).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'amber' as const },
    { label: 'Daily P&L', value: `${summary!.daily_pnl >= 0 ? '+' : ''}$${summary!.daily_pnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, icon: Activity, color: 'green' as const },
    { label: 'Positions', value: `${positions?.length ?? summary!.positions}`, icon: Target, color: 'blue' as const },
  ] : []

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-success/10 glow-green">
            <Briefcase className="w-8 h-8 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portfolio Management</h1>
            <p className="text-sm text-muted-foreground">Institutional-grade portfolio analytics</p>
          </div>
        </div>
        {hasData && (
          <button
            onClick={() => setShowAddPosition(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Position
          </button>
        )}
      </motion.div>

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={cn('p-5 rounded-2xl glass', metric.color === 'amber' && 'border border-primary/20 glow-amber', metric.color === 'green' && 'border border-success/20 glow-green', metric.color === 'blue' && 'border border-accent/20 glow-blue')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <metric.icon className={cn('w-5 h-5', metric.color === 'amber' && 'text-primary', metric.color === 'green' && 'text-success', metric.color === 'blue' && 'text-accent')} />
              </div>
              <div className="text-2xl font-bold font-mono">{metric.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {hasData && (
        <GlassPanel title="Portfolio Equity Curve" subtitle="Historical portfolio value over time" glow="green">
          <div className="h-64 p-4">
            <PortfolioEquityChart portfolioId={portfolioId} />
          </div>
        </GlassPanel>
      )}

      {!hasData ? (
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-8 text-center">
          <PieChart className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-medium text-foreground mb-1">No portfolio data</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Create a portfolio and add positions to track your holdings.
          </p>
          {!showAddPosition ? (
            <button
              onClick={() => setShowAddPosition(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Portfolio & Add Position
            </button>
          ) : (
            <div className="max-w-xl mx-auto border border-border/50 p-4 bg-background rounded-xl text-left mt-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Add Position</span>
                <button onClick={() => setShowAddPosition(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative">
                  <input
                    list="available-symbols"
                    value={newSymbol}
                    onChange={(e) => {
                      const sym = e.target.value.toUpperCase()
                      setNewSymbol(sym)
                      if (quoteMap.has(sym)) {
                        const suggestedPrice = quoteMap.get(sym)!.price.toFixed(2)
                        const currentIsAutoFilled = Array.from(quoteMap.values()).some(q => q.price.toFixed(2) === newPrice)
                        if (!newPrice || currentIsAutoFilled) {
                          setNewPrice(suggestedPrice)
                        }
                      }
                    }}
                    placeholder="Symbol"
                    className="w-full rounded-lg bg-secondary/40 p-2 text-sm font-mono"
                  />
                  <datalist id="available-symbols">
                    {Array.from(quoteMap.values()).map(q => <option key={q.symbol} value={q.symbol}>{q.price.toFixed(2)}</option>)}
                  </datalist>
                </div>
                <input value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Shares" type="number" className="rounded-lg bg-secondary/40 p-2 text-sm font-mono" />
                <div className="relative">
                  <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Avg Price" type="number" step="0.01" className="w-full rounded-lg bg-secondary/40 p-2 text-sm font-mono" />
                  {newSymbol && quoteMap.has(newSymbol) && (
                    <div className="absolute -top-5 left-0 text-[10px] text-muted-foreground whitespace-nowrap">
                      Suggested: ${quoteMap.get(newSymbol)!.price.toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => addPositionMutation.mutate()}
                  disabled={!newSymbol || !newQuantity || !newPrice || addPositionMutation.isPending}
                  className="rounded-lg bg-primary text-primary-foreground p-2 text-sm font-medium disabled:opacity-50"
                >
                  {addPositionMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <GlassPanel title="Active Positions" subtitle={`${positions?.length ?? 0} holdings`} glow="green" delay={0.3}>
              {showAddPosition && (
                <div className="border-b border-border/50 p-4 bg-secondary/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Add Position</span>
                    <button onClick={() => setShowAddPosition(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Symbol" className="rounded-lg bg-secondary/40 p-2 text-sm font-mono" />
                    <input value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Shares" type="number" className="rounded-lg bg-secondary/40 p-2 text-sm font-mono" />
                    <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Avg Price" type="number" step="0.01" className="rounded-lg bg-secondary/40 p-2 text-sm font-mono" />
                    <button
                      onClick={() => addPositionMutation.mutate()}
                      disabled={!newSymbol || !newQuantity || !newPrice || addPositionMutation.isPending}
                      className="rounded-lg bg-primary text-primary-foreground p-2 text-sm font-medium disabled:opacity-50"
                    >
                      {addPositionMutation.isPending ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {!positions?.length ? (
                <div className="p-5 text-center text-sm text-muted-foreground">No positions yet. Add your first position above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-xs text-muted-foreground font-medium p-3">Asset</th>
                        <th className="text-right text-xs text-muted-foreground font-medium p-3">Shares</th>
                        <th className="text-right text-xs text-muted-foreground font-medium p-3">Avg Cost</th>
                        <th className="text-right text-xs text-muted-foreground font-medium p-3">Current</th>
                        <th className="text-right text-xs text-muted-foreground font-medium p-3">P&L</th>
                        <th className="text-right text-xs text-muted-foreground font-medium p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, i) => {
                        const pnl = pos.position_pnl
                        const pnlPercent = pos.position_pnl_pct
                        const liveQuote = quoteMap.get(pos.symbol)
                        return (
                          <motion.tr
                            key={pos.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + i * 0.04 }}
                            className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{pos.symbol}</span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono text-sm">{pos.quantity}</td>
                            <td className="p-3 text-right font-mono text-sm text-muted-foreground">${pos.avg_price.toFixed(2)}</td>
                            <td className="p-3 text-right">
                              <FlashPrice price={liveQuote?.price ?? pos.current_price} size="sm" />
                            </td>
                            <td className="p-3 text-right">
                              <div className={cn('font-mono text-sm', pnl >= 0 ? 'text-success' : 'text-destructive')}>
                                {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </div>
                              <div className={cn('text-[11px]', pnl >= 0 ? 'text-success' : 'text-destructive')}>
                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => deletePositionMutation.mutate(pos.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </div>

          <div className="space-y-6">
            <GlassPanel title="Asset Allocation" subtitle="By sector" glow="blue" delay={0.4}>
              <div className="p-5 text-center">
                <PieChart className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Connect to analytics API for allocation data</p>
              </div>
            </GlassPanel>
            <GlassPanel title="Risk Metrics" subtitle="Portfolio health" delay={0.5}>
              <div className="p-5 text-center">
                <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Connect to risk engine API for risk metrics</p>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioEquityChart({ portfolioId }: { portfolioId?: number }) {
  const { data: analytics } = useQuery({
    queryKey: ['portfolio-equity'],
    queryFn: api.analytics,
    enabled: !!portfolioId,
    refetchInterval: 60_000,
  })

  const chartData = analytics?.rolling_returns?.length
    ? analytics.rolling_returns.map((v: number, i: number) => ({ label: i, value: (1 + v) * (analytics.total_equity || 10000) }))
    : []

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Insufficient snapshot data for equity curve
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" stroke="#8a8a9a" tick={{ fontSize: 10 }} />
        <YAxis stroke="#8a8a9a" tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
        />
        <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
