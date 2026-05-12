'use client'

'use client'

import { motion } from 'framer-motion'
import { LucideIcon, BarChart3, Shield, Globe2, Building2, Bell, Settings } from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { MetricCard } from '@/components/metric-card'
import { InstitutionalFlow } from '@/components/institutional-flow'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface PlaceholderViewProps {
  title: string
  subtitle: string
  icon: LucideIcon
  metrics: Array<{ label: string; value: string }>
}

function PlaceholderView({ title, subtitle, icon: Icon, metrics }: PlaceholderViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-3xl bg-primary/10 glow-amber">
          <Icon className="w-10 h-10 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {metrics.map((item, index) => (
          <MetricCard key={item.label} title={item.label} value={item.value} glowColor={index % 2 === 0 ? 'amber' : 'blue'} size="sm" delay={index * 0.05} />
        ))}
      </div>

      <GlassPanel title="Operational Console" subtitle="Live institution-grade controls">
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          {['Realtime telemetry synced', 'Risk controls active', 'Execution and alert channels healthy', 'AI orchestration pipeline online'].map((line, index) => (
            <div key={line} className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-success" />
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + index * 0.1 }}>
                {line}
              </motion.span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}

export function AnalyticsView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.analytics,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Computing portfolio analytics...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlaceholderView title="Analytics Suite" subtitle="Deep-dive market analytics and insights" icon={BarChart3} metrics={[{ label: 'Status', value: 'Unavailable' }, { label: 'Requires', value: 'auth + positions' }, { label: 'Error', value: 'No data' }]} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-3xl bg-primary/10 glow-amber">
          <BarChart3 className="w-10 h-10 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold">Analytics Suite</h1>
          <p className="text-muted-foreground">Deep-dive portfolio analytics and insights</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Alpha" value={(data.alpha ?? 0).toFixed(4)} glowColor="amber" size="sm" />
        <MetricCard title="Beta" value={(data.beta ?? 0).toFixed(4)} glowColor="blue" size="sm" />
        <MetricCard title="Sharpe" value={(data.sharpe ?? 0).toFixed(4)} glowColor="green" size="sm" />
        <MetricCard title="Sortino" value={(data.sortino ?? 0).toFixed(4)} glowColor="green" size="sm" />
        <MetricCard title="Info Ratio" value={(data.information_ratio ?? 0).toFixed(4)} glowColor="blue" size="sm" />
        <MetricCard title="Total Return" value={`${(data.total_return_pct ?? 0).toFixed(2)}%`} glowColor="amber" size="sm" />
        <MetricCard title="Equity" value={`$${(data.total_equity ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} glowColor="amber" size="sm" />
        <MetricCard title="Invested" value={`$${(data.total_invested ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} glowColor="blue" size="sm" />
      </div>

      <GlassPanel title="Performance Attribution" subtitle="Symbol-level contribution">
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="p-2">Symbol</th>
                <th className="p-2 text-right">Weight</th>
                <th className="p-2 text-right">PnL</th>
                <th className="p-2 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {(data.performance_attribution ?? []).map((row) => (
                <tr key={row.symbol ?? 'unknown'} className="border-b border-border/30">
                  <td className="p-2 font-mono">{row.symbol ?? '—'}</td>
                  <td className="p-2 text-right font-mono">{((row.weight ?? 0) * 100).toFixed(2)}%</td>
                  <td className="p-2 text-right font-mono">${(row.pnl ?? 0).toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">{(row.return_pct ?? 0).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}

export function RiskView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['risk'],
    queryFn: api.risk,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Running risk simulations...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlaceholderView title="Risk Engine" subtitle="Advanced risk management" icon={Shield} metrics={[{ label: 'Status', value: 'Unavailable' }, { label: 'Requires', value: 'auth + positions' }, { label: 'Error', value: 'No data' }]} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-3xl bg-primary/10 glow-amber">
          <Shield className="w-10 h-10 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold">Risk Engine</h1>
          <p className="text-muted-foreground">Advanced risk management and monitoring</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Value at Risk" value={`$${(data.var ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} glowColor="red" size="sm" />
        <MetricCard title="Expected Shortfall" value={`$${(data.expected_shortfall ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} glowColor="red" size="sm" />
        <MetricCard title="Max Drawdown" value={`${((data.max_drawdown ?? 0) * 100).toFixed(2)}%`} glowColor="red" size="sm" />
        <MetricCard title="Concentration" value={(data.concentration_risk ?? 0).toFixed(4)} glowColor="blue" size="sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel title="Stress Tests" subtitle="Scenario analysis">
          <div className="p-4 space-y-2">
            {(data.stress_tests ?? []).map((test) => (
              <div key={test.metric} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                <span>{test.metric}</span>
                <span className="font-mono">${(test.value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel title="Scenario Engine" subtitle="Macro shock scenarios">
          <div className="p-4 space-y-2">
            {(data.scenario_engine ?? []).map((s) => (
              <div key={s.name ?? 'scenario'} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                <span>{s.name ?? '—'}</span>
                <span className={cn('font-mono', (s.shock_pct ?? 0) < 0 ? 'text-destructive' : 'text-success')}>
                  {(s.shock_pct ?? 0) > 0 ? '+' : ''}{s.shock_pct ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

export function MacroView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['macro'],
    queryFn: api.macro,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading macro data...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlaceholderView title="Macro Intelligence" subtitle="Global macroeconomic analysis" icon={Globe2} metrics={[{ label: 'Feeds', value: 'N/A' }, { label: 'Status', value: 'Unavailable' }, { label: 'Note', value: 'Configure provider keys' }]} />
      </div>
    )
  }

  const rates = (data as any).rates ?? {}
  const commodities = (data as any).commodities ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-3xl bg-primary/10 glow-amber">
          <Globe2 className="w-10 h-10 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold">Macro Intelligence</h1>
          <p className="text-muted-foreground">Global macroeconomic data feeds</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(rates).map(([key, val]) => (
          <MetricCard key={key} title={key.toUpperCase()} value={String((val as number)?.toFixed(2) ?? '—')} glowColor="blue" size="sm" />
        ))}
        {Object.entries(commodities).map(([key, val]) => (
          <MetricCard key={key} title={key.toUpperCase()} value={String((val as number)?.toFixed(2) ?? '—')} glowColor="amber" size="sm" />
        ))}
      </div>
    </div>
  )
}

export function FlowView() {
  return <InstitutionalFlow />
}

export function AlertsView() {
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false })
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications,
    enabled: !!me,
    refetchInterval: 7000,
  })
  const [draft, setDraft] = useState('')
  const createMutation = useMutation({
    mutationFn: api.createNotification,
    onSuccess: () => {
      setDraft('')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <div className="space-y-6">
      <PlaceholderView title="Alert Center" subtitle="Custom alerts and notifications" icon={Bell} metrics={[{ label: 'Active Rules', value: `${data?.length ?? 0}` }, { label: 'Today', value: `${data?.length ?? 0}` }, { label: 'Critical', value: `${(data ?? []).filter((n) => !n.is_read).length}` }]} />
      <GlassPanel title="Notification Dispatch" subtitle="Persisted user notifications">
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 rounded-xl bg-secondary/40 p-2 text-sm" placeholder="Create notification" />
            <button onClick={() => draft.trim() && createMutation.mutate(draft)} className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
              Send
            </button>
          </div>
          {(data ?? []).map((n) => (
            <div key={n.id} className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
              {n.message}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}

export function SettingsView() {
  const queryClient = useQueryClient()
  const { data: prefs } = useQuery({ queryKey: ['settings'], queryFn: api.settings })
  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: api.subscription })
  const [density, setDensity] = useState('comfortable')
  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  return (
    <div className="space-y-6">
      <PlaceholderView title="Settings" subtitle="Configure your terminal preferences" icon={Settings} metrics={[{ label: 'Plan', value: sub?.plan ?? 'pro' }, { label: 'Status', value: sub?.status ?? 'active' }, { label: 'Theme', value: String((prefs?.preferences?.theme as string) ?? 'dark') }]} />
      <GlassPanel title="Preferences" subtitle="Persisted user settings">
        <div className="p-4 space-y-3">
          <label className="text-sm text-muted-foreground">Density</label>
          <select value={density} onChange={(e) => setDensity(e.target.value)} className="w-full rounded-xl bg-secondary/40 p-2 text-sm">
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
          <button
            onClick={() => updateMutation.mutate({ ...(prefs?.preferences ?? {}), density })}
            className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Save Settings
          </button>
        </div>
      </GlassPanel>
    </div>
  )
}
