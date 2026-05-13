'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, Bell, Sparkles, ChevronDown, LogOut, Search } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { useRealtimeStore } from '@/lib/realtime-store'

export function Topbar() {
  const router = useRouter()
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      if (typeof window !== 'undefined') localStorage.removeItem('veltrix_access_token')
      router.push('/login')
    },
  })

  const [time, setTime] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const { connected } = useRealtimeStore()
  const { notifications, sidebarExpanded } = useAppStore()

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me, retry: 1, staleTime: 120_000 })
  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: api.quotes, refetchInterval: 12_000, staleTime: 10_000 })

  const spyQ = quotes?.find((q) => q.symbol === 'SPY')
  const initials = me?.email ? me.email.slice(0, 2).toUpperCase() : '??'

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const leftOffset = sidebarExpanded ? 220 : 64

  return (
    <header
      className="fixed top-0 right-0 z-40 flex items-center h-[52px] px-4 gap-3 border-b border-white/[0.06]"
      style={{
        left: leftOffset,
        background: 'rgba(5,5,7,0.72)',
        backdropFilter: 'blur(22px) saturate(150%)',
        transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Market status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,19,26,0.72)', border: '1px solid rgba(220,232,255,0.08)' }}>
        <div className="status-dot live" />
        <span className="text-xs text-gray-400 font-mono">SPY</span>
        {spyQ ? (
          <span className={`text-xs font-mono font-semibold ${spyQ.change >= 0 ? 'text-[#61f2b2]' : 'text-[#ff6b7a]'}`}>
            {spyQ.change >= 0 ? '+' : ''}{spyQ.change.toFixed(2)}%
          </span>
        ) : (
          <span className="text-xs text-gray-600 font-mono">—</span>
        )}
      </div>

      {/* UTC clock */}
      <div className="hidden md:block text-xs font-mono text-gray-500 tabular-nums">{time} UTC</div>

      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        className="hidden lg:flex min-w-[280px] items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-left text-xs text-[#7f8794] transition-colors hover:border-cyan-100/20 hover:bg-white/[0.04]"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1">Search markets, agents, workflows</span>
        <span className="font-mono text-[10px] text-white/28">⌘K</span>
      </button>

      <div className="flex-1" />

      {/* WS status */}
      <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-[#8fd8ff]' : 'text-[#ff6b7a]'}`} title={connected ? 'Connected' : 'Disconnected'}>
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      </div>

      {/* Notifications */}
      <button onClick={() => router.push('/alerts')} className="relative p-2 rounded-lg hover:bg-white/[0.045] text-gray-500 hover:text-gray-200 transition-colors">
        <Bell className="w-4 h-4" />
        {notifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#8fd8ff] text-[9px] font-bold flex items-center justify-center text-black">
            {notifications}
          </span>
        )}
      </button>

      {/* AI Copilot */}
      <button
        onClick={() => router.push('/copilot')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#dce8ff] transition-all hover:text-white"
        style={{ background: 'rgba(143,216,255,0.075)', border: '1px solid rgba(143,216,255,0.16)' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:block">AI Copilot</span>
      </button>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => setProfileOpen(o => !o)}
          onBlur={() => setTimeout(() => setProfileOpen(false), 150)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-[linear-gradient(135deg,#f5f7fb,#8fd8ff_60%,#a78bfa)] flex items-center justify-center text-[11px] font-bold text-black">
            {initials}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
        </button>

        {profileOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-full mt-1.5 w-52 rounded-xl py-1 z-50"
            style={{ background: '#0e0e16', border: '1px solid #1a1a28', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="px-3 py-2 border-b border-white/[0.04]">
              <div className="text-xs font-medium text-gray-200 truncate">{me?.email ?? '—'}</div>
              <div className="text-[10px] text-gray-600 capitalize">{me?.role ?? 'trader'}</div>
            </div>
            <button
              onClick={() => { setProfileOpen(false); logoutMutation.mutate() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </motion.div>
        )}
      </div>
    </header>
  )
}
