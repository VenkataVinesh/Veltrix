'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MetricCardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  glowColor?: 'amber' | 'blue' | 'green' | 'red'
  size?: 'sm' | 'md' | 'lg'
  delay?: number
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon, 
  trend = 'neutral',
  glowColor = 'amber',
  size = 'md',
  delay = 0
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState('0')

  useEffect(() => {
    const numericValue = parseFloat(value.replace(/[^0-9.-]+/g, ''))
    if (isNaN(numericValue)) {
      setDisplayValue(value)
      return
    }

    const duration = 1000
    const steps = 30
    const stepTime = duration / steps
    const increment = numericValue / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current += increment
      if (step >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        const prefix = value.match(/^[^0-9-]*/)?.[0] || ''
        const suffix = value.match(/[^0-9.]*$/)?.[0] || ''
        setDisplayValue(`${prefix}${Math.abs(current).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`)
      }
    }, stepTime)

    return () => clearInterval(timer)
  }, [value])

  const glowClasses = {
    amber: 'glow-amber border-primary/20',
    blue: 'glow-blue border-accent/20',
    green: 'glow-green border-success/20',
    red: 'glow-red border-destructive/20',
  }

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay, 
        type: 'spring', 
        stiffness: 100, 
        damping: 15 
      }}
      whileHover={{ 
        scale: 1.02, 
        y: -2,
        transition: { duration: 0.2 } 
      }}
      className={cn(
        "relative glass rounded-2xl overflow-hidden group cursor-pointer",
        glowClasses[glowColor],
        sizeClasses[size]
      )}
    >
      {/* Ambient glow effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        glowColor === 'amber' && "bg-gradient-to-br from-primary/5 to-transparent",
        glowColor === 'blue' && "bg-gradient-to-br from-accent/5 to-transparent",
        glowColor === 'green' && "bg-gradient-to-br from-success/5 to-transparent",
        glowColor === 'red' && "bg-gradient-to-br from-destructive/5 to-transparent",
      )} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm text-muted-foreground">{title}</span>
          {icon && (
            <motion.div
              className={cn(
                "p-2 rounded-lg",
                glowColor === 'amber' && "bg-primary/10 text-primary",
                glowColor === 'blue' && "bg-accent/10 text-accent",
                glowColor === 'green' && "bg-success/10 text-success",
                glowColor === 'red' && "bg-destructive/10 text-destructive",
              )}
              whileHover={{ rotate: 5 }}
            >
              {icon}
            </motion.div>
          )}
        </div>

        <div className={cn(
          "font-bold font-mono tracking-tight",
          size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-xl'
        )}>
          {displayValue}
        </div>

        {(change !== undefined || changeLabel) && (
          <div className="flex items-center gap-2 mt-2">
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                trend === 'up' && "bg-success/10 text-success",
                trend === 'down' && "bg-destructive/10 text-destructive",
                trend === 'neutral' && "bg-muted text-muted-foreground"
              )}>
                <TrendIcon className="w-3 h-3" />
                <span>{change > 0 ? '+' : ''}{change}%</span>
              </div>
            )}
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '100%'], opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: delay + 1 }}
      />
    </motion.div>
  )
}
