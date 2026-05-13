'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface MiniChartProps {
  data?: number[]
  symbol?: string
  timeframe?: string
  color?: 'green' | 'red' | 'amber' | 'blue'
  height?: number
  width?: number
}

export function MiniChart({
  data,
  symbol,
  timeframe = '1D',
  color = 'green',
  height = 40,
  width = 120
}: MiniChartProps) {
  const { data: liveSeries } = useQuery({
    queryKey: ['mini-chart', symbol, timeframe],
    queryFn: () => api.ohlc(symbol as string, timeframe),
    enabled: Boolean(symbol),
    refetchInterval: 30_000,
  })

  const chartData = useMemo(() => {
    if (data) return data
    if (liveSeries?.points?.length) return liveSeries.points.map((point) => point.c)
    return null
  }, [data, liveSeries])

  if (!chartData?.length) {
    return <svg width={width} height={height} className="overflow-visible" />
  }

  const min = Math.min(...chartData)
  const max = Math.max(...chartData)
  const range = max - min || 1
  const denominator = Math.max(chartData.length - 1, 1)

  const points = chartData.map((value, index) => {
    const x = (index / denominator) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const fillPoints = `0,${height} ${points} ${width},${height}`

  const colorClasses = {
    green: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)' },
    red: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)' },
    amber: { stroke: '#8fd8ff', fill: 'rgba(143, 216, 255, 0.1)' },
    blue: { stroke: '#8fd8ff', fill: 'rgba(143, 216, 255, 0.1)' },
  }

  return (
    <motion.svg
      width={width}
      height={height}
      className="overflow-visible"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colorClasses[color].stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorClasses[color].stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.polygon
        points={fillPoints}
        fill={`url(#gradient-${color})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      />

      <motion.polyline
        points={points}
        fill="none"
        stroke={colorClasses[color].stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />

      <motion.circle
        cx={width}
        cy={height - ((chartData[chartData.length - 1] - min) / range) * height}
        r="3"
        fill={colorClasses[color].stroke}
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.svg>
  )
}
