'use client'

import { useWebSocket } from '@/lib/use-websocket'
import { useEffect, useState } from 'react'

/**
 * Live ticker showing real‑time price updates for top symbols.
 * Subscribes to the `quotes` channel via the WebSocket manager.
 */
export function LiveTicker() {
  const { subscribe } = useWebSocket()
  const [quotes, setQuotes] = useState<Array<{ symbol: string; price: number; change: number }>>([])

  useEffect(() => {
    const unsub = subscribe('quotes', (payload) => {
      // Payload shape: { symbol, price, change, ... }
      const q = payload as { symbol: string; price: number; change: number }
      setQuotes((prev) => {
        const idx = prev.findIndex((item) => item.symbol === q.symbol)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = q
          return next
        }
        return [...prev, q].slice(-7) // keep last 7
      })
    })
    return () => {
      unsub()
    }
  }, [subscribe])

  return (
    <div className="flex gap-4 overflow-x-auto py-2 px-1">
      {quotes.map((q) => (
        <div key={q.symbol} className="flex items-center gap-1 whitespace-nowrap text-sm">
          <span className="font-mono font-bold text-white">{q.symbol}</span>
          <span className="text-gray-400">{(q.price ?? 0).toFixed(2)}</span>
          <span className={`ml-1 ${(q.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>({(q.change ?? 0) >= 0 ? '+' : ''}{(q.change ?? 0).toFixed(2)}%)</span>
        </div>
      ))}
    </div>
  )
}
