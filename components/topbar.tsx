'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, Bell, ChevronDown, LogOut, Search, TerminalSquare } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { useRealtimeStore } from '@/lib/realtime-store'
import { cn } from '@/lib/utils'

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
  const initials = me?.email ? me.email.slice(0, 2).toUpperCase() : '··'

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const leftOffset = sidebarExpanded ? 200 : 56

  return (
    <header
      className="fixed right-0 top-0 z-40 flex h-[48px] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-sm"
      style={{ left: leftOffset, transition: 'left 0.16s ease-out' }}
    >
      {/* Market status */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1">
        <div className="status-dot live" />
        <span className="font-mono text-[11px] text-muted-foreground">SPY</span>
        {spyQ ? (
          <span className={cn('font-mono text-[11px] font-semibold', spyQ.change >= 0 ? 'text-success' : 'text-destructive')}>
            {spyQ.change >= 0 ? '+' : ''}{spyQ.change.toFixed(2)}%
          </span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">—</span>
        )}
      </div>

      {/* UTC clock */}
      <div className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:block">{time} UTC</div>

      {/* Command palette trigger */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        className="hidden min-w-[260px] items-center gap-2 rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:flex"
      >
        <Search className="h-3 w-3" />
        <span className="flex-1">Search symbols, views…</span>
        <kbd className="rounded-sm border border-border bg-background px-1 py-px text-[9px]">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* WS status */}
      <div
        className={cn('flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider', connected ? 'text-success' : 'text-destructive')}
        title={connected ? 'Realtime stream connected' : 'Realtime stream disconnected'}
      >
        {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span className="hidden xl:inline">{connected ? 'live' : 'offline'}</span>
      </div>

      {/* Notifications */}
      <button
        onClick={() => router.push('/alerts')}
        aria-label="Alerts"
        className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {notifications > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] font-bold text-primary-foreground">
            {notifications}
          </span>
        )}
      </button>

      {/* Copilot */}
      <button
        onClick={() => router.push('/copilot')}
        className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
      >
        <TerminalSquare className="h-3.5 w-3.5" />
        <span className="hidden sm:block">Copilot</span>
      </button>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => setProfileOpen((o) => !o)}
          onBlur={() => setTimeout(() => setProfileOpen(false), 150)}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-secondary"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-border bg-secondary font-mono text-[10px] font-semibold text-foreground">
            {initials}
          </div>
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
        </button>

        {profileOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-popover py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="truncate font-mono text-[11px] text-foreground">{me?.email ?? '—'}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{me?.role ?? 'trader'}</div>
            </div>
            <button
              onClick={() => { setProfileOpen(false); logoutMutation.mutate() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 font-mono text-[11px] text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </motion.div>
        )}
      </div>
    </header>
  )
}
