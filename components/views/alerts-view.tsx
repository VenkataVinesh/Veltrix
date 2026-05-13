'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Trash2, Plus, X, AlertTriangle, Info, Zap } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useRealtimeChannel } from '@/lib/realtime-store'

function Card({ children, className = 'p-5' }: { children: React.ReactNode; className?: string }) {
  return <div className={`premium-card ${className}`}>{children}</div>
}

export function AlertsView() {
  const qc = useQueryClient()
  const [newMsg, setNewMsg] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: notifs = [], isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
  })

  // All hooks MUST come before any conditional returns
  useRealtimeChannel('notifications', () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
  })

  const createMut = useMutation({
    mutationFn: (msg: string) => api.createNotification(msg),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); setNewMsg(''); setShowCreate(false) },
  })

  const getIcon = (msg: string) => {
    const l = msg.toLowerCase()
    if (l.includes('buy') || l.includes('signal')) return Zap
    if (l.includes('risk') || l.includes('loss') || l.includes('warn')) return AlertTriangle
    return Info
  }
  const getColor = (msg: string) => {
    const l = msg.toLowerCase()
    if (l.includes('buy')) return '#10b981'
    if (l.includes('sell') || l.includes('risk') || l.includes('loss')) return '#ef4444'
    if (l.includes('warn')) return '#f59e0b'
    return '#06b6d4'
  }

  if (isError) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-600">Alerts unavailable — please log in to access notifications.</p>
    </div>
  )

  return (
    <div className="space-y-5 max-w-[900px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Alerts</h2>
          <p className="text-xs text-gray-600 mt-0.5">Realtime notifications · {notifs.length} total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-amber-400 transition-all"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </motion.div>

      {/* Create alert modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Create Alert</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-600 hover:text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-3">
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="e.g. SPY above $600, BTC BUY signal triggered..."
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500/40"
                  style={{ background: '#0a0a0f', border: '1px solid #1a1a24' }}
                  onKeyDown={e => e.key === 'Enter' && newMsg.trim() && createMut.mutate(newMsg.trim())}
                />
                <button
                  onClick={() => newMsg.trim() && createMut.mutate(newMsg.trim())}
                  disabled={!newMsg.trim() || createMut.isPending}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-50"
                  style={{ background: '#f59e0b' }}>
                  {createMut.isPending ? '...' : 'Create'}
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: notifs.length, color: '#06b6d4' },
          { label: 'Unread', value: notifs.filter(n => !n.is_read).length, color: '#f59e0b' },
          { label: 'This Session', value: notifs.filter(n => {
            const t = new Date(n.id).getTime(); return Date.now() - t < 3600_000
          }).length || notifs.length, color: '#10b981' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-xs text-gray-600 mb-1">{s.label}</p>
            <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Alert feed */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
          <div className="status-dot live" />
          <h3 className="text-sm font-semibold text-white">Live Feed</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Bell className="w-8 h-8 text-gray-700" />
            <p className="text-sm text-gray-600">No alerts yet</p>
            <p className="text-xs text-gray-700">Create one above or they'll appear automatically</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {notifs.map((n, i) => {
              const Icon = getIcon(n.message)
              const color = getColor(n.message)
              return (
                <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}15` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Alert #{n.id}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.03] text-gray-600 hover:text-gray-400 cursor-pointer">
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
