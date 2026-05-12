'use client'

import { motion } from 'framer-motion'
import { Brain, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIConfidenceProps {
  signal: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning?: string
}

export function AIConfidence({ signal, confidence, reasoning }: AIConfidenceProps) {
  const signalConfig = {
    bullish: {
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      icon: TrendingUp,
      label: 'BULLISH',
      glow: 'glow-green',
    },
    bearish: {
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      icon: TrendingDown,
      label: 'BEARISH',
      glow: 'glow-red',
    },
    neutral: {
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      icon: AlertTriangle,
      label: 'NEUTRAL',
      glow: 'glow-amber',
    },
  }

  const config = signalConfig[signal]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative p-5 rounded-2xl glass border overflow-hidden",
        config.border
      )}
    >
      {/* Background glow */}
      <div className={cn(
        "absolute inset-0 opacity-20",
        signal === 'bullish' && "bg-gradient-to-br from-success/20 to-transparent",
        signal === 'bearish' && "bg-gradient-to-br from-destructive/20 to-transparent",
        signal === 'neutral' && "bg-gradient-to-br from-primary/20 to-transparent",
      )} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", config.bg)}>
              <Brain className={cn("w-5 h-5", config.color)} />
            </div>
            <span className="text-sm text-muted-foreground">AI Intelligence</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
            config.bg, config.color
          )}>
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </div>
        </div>

        {/* Confidence Meter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Confidence Score</span>
            <span className={cn("text-2xl font-bold font-mono", config.color)}>
              {confidence}%
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                signal === 'bullish' && "bg-gradient-to-r from-success/50 to-success",
                signal === 'bearish' && "bg-gradient-to-r from-destructive/50 to-destructive",
                signal === 'neutral' && "bg-gradient-to-r from-primary/50 to-primary",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </div>
        </div>

        {/* Reasoning */}
        {reasoning && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {reasoning}
          </p>
        )}

        {/* Neural indicators */}
        <div className="flex items-center gap-2 mt-4">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < Math.floor(confidence / 20) ? config.bg : "bg-secondary"
              )}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.1 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
