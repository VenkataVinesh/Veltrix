'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DataSourceBadge } from '@/components/data-source-badge'

type FlashPriceProps = {
  price: number
  prevPrice?: number
  change?: number
  changePct?: number
  provider?: string
  realtime?: boolean
  stale?: boolean
  size?: 'sm' | 'md' | 'lg'
  showBadge?: boolean
}

export function FlashPrice({ price, prevPrice, change, changePct, provider, realtime, stale, size = 'md', showBadge }: FlashPriceProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const flashClass = useRef('')

  useEffect(() => {
    if (!ref.current || prevPrice == null || prevPrice === price) return
    const direction = price >= prevPrice ? 'up' : 'down'
    flashClass.current = direction === 'up' ? 'flash-up' : 'flash-down'
    ref.current.classList.remove('flash-up', 'flash-down')
    void ref.current.offsetWidth
    ref.current.classList.add(flashClass.current)
  }, [price, prevPrice])

  const sizeClasses = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }

  return (
    <span className="inline-flex items-center gap-2">
      <span ref={ref} className={cn('font-mono font-bold rounded px-1 transition-colors', sizeClasses[size])}>
        ${price.toFixed(2)}
      </span>
      {change != null && (
        <span className={cn('font-mono text-sm', change >= 0 ? 'text-success' : 'text-destructive')}>
          {change >= 0 ? '+' : ''}{changePct != null ? `${changePct.toFixed(2)}%` : change.toFixed(2)}
        </span>
      )}
      {showBadge && provider && (
        <DataSourceBadge provider={provider} realtime={realtime} stale={stale} />
      )}
    </span>
  )
}
