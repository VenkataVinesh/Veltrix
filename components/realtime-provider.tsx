'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeManager } from '@/lib/realtime-manager'
import { useRealtimeChannel } from '@/lib/realtime-store'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    realtimeManager.connectIfNeeded()
  }, [])

  // Subscribe to quotes channel — updates react-query cache
  useRealtimeChannel('quotes', (payload) => {
    if (Array.isArray(payload)) {
      queryClient.setQueryData(['quotes'], payload)
    }
  })

  // Subscribe to notifications channel
  useRealtimeChannel('notifications', () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  return <>{children}</>
}
