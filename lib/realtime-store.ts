'use client'

import { create } from 'zustand'
import { realtimeManager } from '@/lib/realtime-manager'
import { useEffect, useState } from 'react'

type RealtimeState = {
  connected: boolean
  stale: boolean
  connectedSince: string | null
  messagesReceived: number
  reconnects: number
  subscriptions: string[]
}

export const useRealtimeStore = create<RealtimeState>(() => ({
  connected: false,
  stale: false,
  connectedSince: null,
  messagesReceived: 0,
  reconnects: 0,
  subscriptions: [],
}))

// Sync zustand store with manager state
realtimeManager.onStateChange((state) => {
  useRealtimeStore.setState(state)
})

// Wraps a channel subscription in a React hook with auto-cleanup
export function useRealtimeChannel(channel: string | null, handler?: (payload: unknown) => void) {
  const [lastMessage, setLastMessage] = useState<unknown | null>(null)

  useEffect(() => {
    if (!channel) return

    realtimeManager.connectIfNeeded()

    const wrappedHandler = handler ?? ((payload: unknown) => setLastMessage(payload))
    const unsubscribe = realtimeManager.subscribe(channel, wrappedHandler)
    return () => unsubscribe()
  }, [channel, handler])

  return lastMessage
}

// Hook to subscribe to quotes updates
export function useQuoteUpdates(handler?: (quotes: unknown) => void) {
  useRealtimeChannel('quotes', handler)
}

// Hook to subscribe to notification updates
export function useNotificationUpdates(handler?: (notification: unknown) => void) {
  useRealtimeChannel('notifications', handler)
}
