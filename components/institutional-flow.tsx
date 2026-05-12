'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Building2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

interface FlowItem {
  symbol: string
  action: string
  label: string
  amount: string
  confidence: number
  price: number
  price_change_pct: number
  timestamp: string
  source: string
}

function formatTime(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function InstitutionalFlow() {
  const [flowData, setFlowData] = useState<FlowItem[]>([])
  const [summary, setSummary] = useState<{ buy_flow: number; sell_flow: number; net_flow: number; tracked_symbols: number; signals: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadFlow = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getInstitutionalFlow()
        if (!mounted) return
        setFlowData(data.items)
        setSummary(data.summary)
      } catch (err) {
        console.error('Failed to fetch institutional flow:', err)
        if (!mounted) return
        setError('Unable to load live flow data')
        setFlowData([])
        setSummary(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadFlow()
    const interval = setInterval(loadFlow, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-3 flex items-center justify-center h-64">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-success border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading live flow signals...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive/80">
            <span className="font-semibold">Live feed unavailable:</span> {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-xs text-success/80 truncate">
            <span className="font-semibold">Live Flow:</span> Derived from volume spikes and momentum across liquid symbols.
          </p>
        </div>
        {summary ? (
          <div className="text-[10px] text-success/80 whitespace-nowrap">
            {summary.signals} signals · Net {summary.net_flow >= 0 ? '+' : '-'}${Math.abs(summary.net_flow / 1_000_000).toFixed(1)}M
          </div>
        ) : null}
      </div>
      
      {summary ? (
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <div className="uppercase tracking-wide">Buy flow</div>
            <div className="mt-1 font-mono text-sm text-foreground">${(summary.buy_flow / 1_000_000).toFixed(1)}M</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <div className="uppercase tracking-wide">Sell flow</div>
            <div className="mt-1 font-mono text-sm text-foreground">${(summary.sell_flow / 1_000_000).toFixed(1)}M</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            <div className="uppercase tracking-wide">Tracked</div>
            <div className="mt-1 font-mono text-sm text-foreground">{summary.tracked_symbols}</div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {flowData.map((flow, index) => (
        <motion.div
          key={`${flow.symbol}-${index}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
          className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              flow.action === 'BUY' ? "bg-success/10" : "bg-destructive/10"
            )}>
              {flow.action === 'BUY' ? (
                <ArrowUpRight className="w-4 h-4 text-success" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm">{flow.symbol}</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  flow.action === 'BUY' ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                )}>
                  {flow.action}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="w-3 h-3" />
                {flow.label}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold">${flow.amount}</div>
            <div className="text-xs text-muted-foreground">{formatTime(flow.timestamp)}</div>
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  )
}

