'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Settings, User, Bell, Shield, Monitor, Save, Check } from 'lucide-react'
import { api } from '@/lib/api-client'

function Card({ children, className = 'p-5' }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-10 h-5 rounded-full transition-colors" style={{ background: on ? '#f59e0b' : '#1a1a28' }}>
      <motion.div animate={{ x: on ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow" />
    </button>
  )
}

export function SettingsView() {
  const [saved, setSaved] = useState(false)
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 120_000 })
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 60_000 })
  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: api.subscription, staleTime: 120_000 })

  const [prefs, setPrefs] = useState<Record<string, unknown>>({
    notifications_enabled: true,
    realtime_enabled: true,
    dark_mode: true,
    show_pnl: true,
    compact_view: false,
    sound_alerts: false,
  })

  const updateMut = useMutation({
    mutationFn: () => api.updateSettings({ ...((settingsData?.preferences as Record<string, unknown>) ?? {}), ...prefs }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const toggle = (key: string) => setPrefs(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="space-y-5 max-w-[800px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-xs text-gray-600 mt-0.5">Account preferences & configuration</p>
      </motion.div>

      {/* Account */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg font-bold text-black">
              {me?.email?.slice(0, 2).toUpperCase() ?? '??'}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{me?.email ?? 'Loading...'}</p>
              <p className="text-xs text-gray-600 capitalize">{me?.role ?? 'trader'} · ID #{me?.id}</p>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                {sub?.plan ?? 'Free'} Plan
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl p-3" style={{ background: '#0a0a0f', border: '1px solid #141420' }}>
              <p className="text-gray-600 mb-1">Subscription</p>
              <p className="text-white font-semibold capitalize">{sub?.plan ?? '—'}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#0a0a0f', border: '1px solid #141420' }}>
              <p className="text-gray-600 mb-1">Status</p>
              <p className="text-emerald-400 font-semibold capitalize">{sub?.status ?? 'Active'}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Preferences */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Preferences</h3>
          <div className="space-y-4">
            {[
              { key: 'notifications_enabled', label: 'Push Notifications', desc: 'Alert when signals fire' },
              { key: 'realtime_enabled', label: 'Realtime Streaming', desc: 'WebSocket live data' },
              { key: 'show_pnl', label: 'Show P&L', desc: 'Display live profit/loss' },
              { key: 'compact_view', label: 'Compact View', desc: 'Denser information layout' },
              { key: 'sound_alerts', label: 'Sound Alerts', desc: 'Audio on triggered alerts' },
            ].map(p => (
              <div key={p.key} className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-0">
                <div>
                  <p className="text-sm text-gray-300">{p.label}</p>
                  <p className="text-xs text-gray-600">{p.desc}</p>
                </div>
                <Toggle on={!!prefs[p.key]} onChange={() => toggle(p.key)} />
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Terminal config */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Terminal Configuration</h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Default Symbol', value: 'SPY' },
              { label: 'Default Timeframe', value: '1H' },
              { label: 'Data Refresh Rate', value: '10s' },
              { label: 'Theme', value: 'Dark (Veltrix)' },
            ].map(c => (
              <div key={c.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: '#0a0a0f', border: '1px solid #141420' }}>
                <span className="text-xs text-gray-600">{c.label}</span>
                <span className="text-xs font-mono text-gray-400">{c.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Save */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <button
          onClick={() => updateMut.mutate()}
          disabled={updateMut.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-black transition-all disabled:opacity-60"
          style={{ background: '#f59e0b' }}>
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : updateMut.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
      </motion.div>
    </div>
  )
}
