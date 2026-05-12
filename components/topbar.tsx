'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { 
  Search, 
  Bell, 
  Wifi, 
  WifiOff, 
  Activity, 
  Sparkles,
  ChevronDown
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useRealtimeStore } from '@/lib/realtime-store'

export function Topbar() {
  const router = useRouter()
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => router.push('/login'),
  })
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const { connected, stale } = useRealtimeStore()
  const { notifications, setAiCopilotOpen, sidebarExpanded } = useAppStore()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      }))
      setDate(now.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        timeZone: 'UTC'
      }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className={cn(
        "fixed top-4 right-4 z-40 glass rounded-2xl transition-all duration-300",
        sidebarExpanded ? "left-[calc(16rem+2rem)]" : "left-[calc(5rem+2rem)]"
      )}
    >
      <div className="flex items-center justify-between h-16 px-6">
        {/* AI Search */}
        <div className="flex-1 max-w-xl">
          <motion.div 
            className="relative group"
            whileHover={{ scale: 1.01 }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Ask AI anything about markets..."
              className="w-full pl-11 pr-4 py-2.5 bg-secondary/50 border border-border/50 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-[10px] text-muted-foreground">
              <span>⌘</span>
              <span>K</span>
            </div>
          </motion.div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 ml-6">
          {/* Market Status */}
          <div className="hidden lg:flex items-center gap-6 px-4 py-2 rounded-xl bg-secondary/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-muted-foreground">Markets Open</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-success" />
              <span className="text-xs font-mono text-success">+2.4%</span>
            </div>
          </div>

          {/* UTC Clock */}
          <div className="hidden md:flex flex-col items-end px-4">
            <span className="text-xs text-muted-foreground">{date}</span>
            <span className="text-sm font-mono font-medium">{time} UTC</span>
          </div>

          {/* Connection Status */}
          <motion.div
            className={cn(
              "p-2 rounded-lg transition-colors",
              connected ? "text-success" : "text-destructive"
            )}
            animate={{ opacity: connected ? 1 : [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: connected ? 0 : Infinity }}
          >
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </motion.div>
          {stale && <span className="text-[10px] text-primary">stale</span>}

          {/* Notifications */}
          <motion.button
            className="relative p-2 rounded-xl hover:bg-secondary/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground"
              >
                {notifications}
              </motion.span>
            )}
          </motion.button>

          {/* AI Copilot */}
          <motion.button
            onClick={() => {
              setAiCopilotOpen(true)
              router.push('/copilot')
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary hover:from-primary/30 hover:to-primary/20 transition-all glow-amber"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI Copilot</span>
          </motion.button>

          {/* Profile */}
          <motion.button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-secondary/50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">JD</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        </div>
      </div>
    </motion.header>
  )
}
