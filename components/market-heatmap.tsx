'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

interface SectorData {
  name: string
  change: number
  weight: number
}

export function MarketHeatmap() {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchSectors = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getSectorHeatmap()
        if (mounted) setSectors(data)
      } catch (err) {
        console.error('Failed to fetch sector data:', err)
        if (mounted) {
          setError('Unable to load sector data')
          setSectors([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchSectors()
    const interval = setInterval(fetchSectors, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const getColor = (change: number) => {
    if (change >= 2) return 'bg-success'
    if (change >= 1) return 'bg-success/70'
    if (change >= 0) return 'bg-success/40'
    if (change >= -1) return 'bg-destructive/40'
    if (change >= -2) return 'bg-destructive/70'
    return 'bg-destructive'
  }

  if (loading) {
    return (
      <div className="p-5 space-y-3 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading sector data...</span>
      </div>
    )
  }

  if (error || sectors.length === 0) {
    return (
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive/80">
            <span className="font-semibold">Error:</span> {error || 'Unable to load sector performance'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/30">
        <AlertCircle className="w-3 h-3 text-success flex-shrink-0" />
        <p className="text-xs text-success/80">
          <span className="font-semibold">Live:</span> Real-time sector performance
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {sectors.map((sector, index) => (
          <motion.div
            key={sector.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05, zIndex: 10 }}
            className={cn('relative rounded-lg p-3 cursor-pointer transition-all', getColor(sector.change))}
            style={{
              gridColumn: sector.weight > 15 ? 'span 2' : 'span 1',
              gridRow: sector.weight > 20 ? 'span 2' : 'span 1',
            }}
          >
            <div className="text-xs font-medium text-white/90 truncate">{sector.name}</div>
            <div className="text-sm font-bold text-white mt-1">
              {sector.change >= 0 ? '+' : ''}
              {sector.change}%
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
