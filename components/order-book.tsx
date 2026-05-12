'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { api } from '@/lib/api-client'

interface OrderBookProps {
  symbol: string
}

export function OrderBook({ symbol }: OrderBookProps) {
  const { data } = useQuery({
    queryKey: ['orderbook', symbol],
    queryFn: () => api.orderbook(symbol),
    refetchInterval: 15_000,
  })

  const orders = useMemo(() => {
    const normalize = (rows: Array<[number, number, number]> | undefined) =>
      (rows ?? []).map(([price, size, total]) => ({
        price: price.toFixed(2),
        size: Math.round(size),
        total: Math.round(total),
      }))

    const bids = normalize(data?.bids).sort((left, right) => Number(right.price) - Number(left.price))
    const asks = normalize(data?.asks).sort((left, right) => Number(left.price) - Number(right.price))
    const maxTotal = Math.max(...[...bids, ...asks].map((order) => order.total), 1)
    return { bids, asks, maxTotal, mid: data?.mid ?? 0, spread: data?.spread ?? 0, source: data?.source ?? 'derived' }
  }, [data])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/50">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (reversed) */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col-reverse">
          {orders.asks.slice().reverse().map((order, i) => (
            <motion.div
              key={`ask-${i}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-destructive/5 cursor-pointer"
            >
              <div
                className="absolute inset-y-0 right-0 bg-destructive/10"
                style={{ width: `${(order.total / orders.maxTotal) * 100}%` }}
              />
              <span className="relative text-destructive font-mono">{order.price}</span>
              <span className="relative text-right font-mono">{order.size.toLocaleString()}</span>
              <span className="relative text-right font-mono text-muted-foreground">
                {order.total.toLocaleString()}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Spread */}
      <div className="px-4 py-2 border-y border-border/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Spread</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-primary">${orders.spread.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">{orders.source}</span>
        </div>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden">
        {orders.bids.map((order, i) => (
          <motion.div
            key={`bid-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-success/5 cursor-pointer"
          >
            <div
              className="absolute inset-y-0 right-0 bg-success/10"
              style={{ width: `${(order.total / orders.maxTotal) * 100}%` }}
            />
              <span className="relative text-success font-mono">{order.price}</span>
            <span className="relative text-right font-mono">{order.size.toLocaleString()}</span>
            <span className="relative text-right font-mono text-muted-foreground">
              {order.total.toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
