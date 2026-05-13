'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
  glow?: 'amber' | 'blue' | 'green' | 'red' | 'none'
  delay?: number
  animate?: boolean
}

export function GlassPanel({ 
  children, 
  className, 
  title, 
  subtitle,
  headerAction,
  glow = 'none',
  delay = 0,
  animate = true
}: GlassPanelProps) {
  const glowClasses = {
    amber: 'border-cyan-100/15',
    blue: 'border-accent/20',
    green: 'border-success/20',
    red: 'border-destructive/20',
    none: 'border-border/50',
  }

  const Wrapper = animate ? motion.div : 'div'
  const wrapperProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, type: 'spring' as const, stiffness: 100, damping: 15 }
  } : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "premium-card overflow-hidden",
        glowClasses[glow],
        className
      )}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            {title && <h3 className="font-semibold text-sm">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className={cn(
        !title && !headerAction ? "" : ""
      )}>
        {children}
      </div>
    </Wrapper>
  )
}
