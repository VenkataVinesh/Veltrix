'use client'

import { useRef, useState, useCallback } from 'react'

type FlashDirection = 'up' | 'down' | null

export function usePriceFlash(threshold = 0.001) {
  const prevRef = useRef<number | null>(null)
  const [flash, setFlash] = useState<FlashDirection>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkFlash = useCallback((currentPrice: number) => {
    const prev = prevRef.current
    prevRef.current = currentPrice

    if (prev == null) return null

    const pctChange = Math.abs((currentPrice - prev) / prev)
    if (pctChange < threshold) return null

    const direction: FlashDirection = currentPrice >= prev ? 'up' : 'down'
    setFlash(direction)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlash(null), 600)

    return direction
  }, [threshold])

  const clearFlash = useCallback(() => {
    setFlash(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { flash, checkFlash, clearFlash }
}
