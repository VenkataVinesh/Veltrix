"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useWebSocket } from "@/lib/use-websocket"
import { Wifi, WifiOff, AlertTriangle } from "lucide-react"

export function ConnectionStatus() {
  const { state } = useWebSocket()
  const isLive = state.connected && !state.stale
  const isStale = state.connected && state.stale
  const isOffline = !state.connected
  const label = isLive ? "Live" : isStale ? "Stale" : "Offline"
  const color = isLive ? "#8fd8ff" : isStale ? "#a78bfa" : "#ff6b7a"
  const bg = isLive ? "rgba(16,185,129,0.08)" : isStale ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)"
  const brd = isLive ? "rgba(16,185,129,0.2)" : isStale ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={label}
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -4 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium"
        style={{ background: bg, border: `1px solid ${brd}`, color }}
        title={`WebSocket ${label}${state.reconnects > 0 ? ' · ${state.reconnects} reconnects' : ''}`}
      >
        {isLive && (<><span className="status-dot live" /><Wifi className="w-3 h-3" /><span className="hidden sm:inline">Live</span></>)}
        {isStale && (<><span className="status-dot stale" /><AlertTriangle className="w-3 h-3" /><span className="hidden sm:inline">Stale</span></>)}
        {isOffline && (<><span className="status-dot offline" /><WifiOff className="w-3 h-3" /><span className="hidden sm:inline">Offline</span></>)}
      </motion.div>
    </AnimatePresence>
  )
}
