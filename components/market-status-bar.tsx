'use client'

import { Activity, Wifi, WifiOff, Server } from 'lucide-react'
import { useRealtimeStore } from '@/lib/realtime-store'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

function isMarketHours() {
  const now = new Date()
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  const hour = ny.getHours()
  const minute = ny.getMinutes()
  const totalMinutes = hour * 60 + minute
  if (day === 0 || day === 6) return false
  return totalMinutes >= 570 && totalMinutes < 960
}

export function MarketStatusBar() {
  const { connected, stale, messagesReceived, subscriptions } = useRealtimeStore()
  const marketOpen = isMarketHours()
  const { data: providerHealth } = useQuery({
    queryKey: ['provider-health'],
    queryFn: () => fetch('/api/v1/providers/health').then((r) => r.json()).catch(() => []),
    refetchInterval: 30_000,
  })

  const providers = (providerHealth ?? []) as Array<{ name: string; healthy: boolean; error_count: number }>

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 text-[10px] text-muted-foreground border-b border-border/30 bg-secondary/10">
      {/* Market Status */}
      <div className="flex items-center gap-1.5">
        <div className={cn('w-1.5 h-1.5 rounded-full', marketOpen ? 'bg-success animate-pulse' : 'bg-muted-foreground')} />
        <span>{marketOpen ? 'OPEN' : 'CLOSED'}</span>
      </div>

      {/* WS Status */}
      <div className="flex items-center gap-1.5">
        {connected ? (
          <Wifi className="w-3 h-3 text-success" />
        ) : (
          <WifiOff className="w-3 h-3 text-destructive" />
        )}
        <span>{stale ? 'STALE' : connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      {/* Messages */}
      <span className="text-[10px] text-muted-foreground/60">
        {messagesReceived} msgs
      </span>

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <span className="text-[10px] text-muted-foreground/60">
          {subscriptions.length} channels
        </span>
      )}

      {/* Provider Health */}
      <div className="flex items-center gap-2 ml-auto">
        <Server className="w-3 h-3" />
        {providers.map((p) => (
          <span key={p.name} className="flex items-center gap-1">
            <div className={cn('w-1 h-1 rounded-full', p.healthy ? 'bg-success' : 'bg-destructive')} />
            <span className={p.healthy ? 'text-success' : 'text-destructive'}>{p.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
