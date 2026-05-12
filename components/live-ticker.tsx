'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

export function LiveTicker() {
  const { data } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    refetchInterval: 8000,
  })
  const tickerData = data ?? []

  return (
    <div className="relative overflow-hidden py-3 bg-secondary/30 border-y border-border/50">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: [0, -1000] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {[...tickerData, ...tickerData].map((item, index) => (
          <Link key={index} href={`/stocks/${item.symbol}`} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-secondary/60">
            <span className="font-mono font-medium text-sm">{item.symbol}</span>
            <span className="font-mono text-sm text-muted-foreground">
              ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className={cn(
              "font-mono text-xs px-1.5 py-0.5 rounded",
              item.change >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
            )}>
              {item.change >= 0 ? '+' : ''}{item.change}%
            </span>
          </Link>
        ))}
      </motion.div>
    </div>
  )
}
