'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { realtimeManager } from '@/lib/realtime-manager'
import type { ConnectionState } from '@/lib/realtime-manager'

/**
 * Hook that links React components to the global RealtimeManager.
 * It ensures the websocket connection is alive, provides connection state,
 * and offers a convenient `subscribe` method that returns an unsubscribe
 * function. The hook abstracts the low‑level manager so UI components can
 * focus on rendering data.
 */
export function useWebSocket() {
  const [state, setState] = useState<ConnectionState>(realtimeManager.state)

  // Track which channels have been subscribed via this hook instance –
  // prevents duplicate subscriptions when the component re‑renders.
  const activeChannels = useRef<Set<string>>(new Set())

  // Initialise connection and state listener once.
  useEffect(() => {
    realtimeManager.connectIfNeeded()
    const off = realtimeManager.onStateChange(setState)
    return () => {
      off()
    }
  }, [])

  /**
   * Subscribe to a channel with a payload handler.
   * Returns an `unsubscribe` function that removes the handler and updates the internal set.
   */
  const subscribe = useCallback((channel: string, handler: (payload: unknown) => void) => {
    if (activeChannels.current.has(channel)) {
      // Already subscribed; just add the handler via manager (may be duplicate).
      const unsub = realtimeManager.subscribe(channel, handler)
      return unsub
    }
    const unsub = realtimeManager.subscribe(channel, handler)
    activeChannels.current.add(channel)
    // When unsubscribing, clean up the tracking set.
    return () => {
      unsub()
      activeChannels.current.delete(channel)
    }
  }, [])

  return { state, subscribe }
}
