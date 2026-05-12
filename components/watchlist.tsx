'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Star, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MiniChart } from './mini-chart'
import { api } from '@/lib/api-client'

export function Watchlist() {
  const { data } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.watchlist,
    refetchInterval: 10000,
  })
  const watchlistData = (data ?? []).map((item: any) => ({
    symbol: item.symbol,
    name: item.name ?? item.symbol,
    price: Number(item.price ?? 0),
    change: Number(item.change ?? 0),
    starred: true,
  }))

  return (
    <div className="space-y-1 p-2">
      {watchlistData.map((item, index) => (
        <motion.div
          key={item.symbol}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          className="relative flex items-center justify-between p-3 rounded-xl cursor-pointer group"
        >
          <Link href={`/stocks/${item.symbol}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${item.symbol} details`} />
          <div className="relative z-10 flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "transition-colors",
                item.starred ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Star className={cn("w-4 h-4", item.starred && "fill-current")} />
            </motion.button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm">{item.symbol}</span>
                {item.change >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="hidden sm:block">
              <MiniChart 
                symbol={item.symbol}
                timeframe="1D"
                color={item.change >= 0 ? 'green' : 'red'} 
                height={24} 
                width={48} 
              />
            </div>
            <div className="text-right">
              <div className="font-mono text-sm">${item.price.toFixed(2)}</div>
              <div className={cn(
                "text-xs font-mono",
                item.change >= 0 ? "text-success" : "text-destructive"
              )}>
                {item.change >= 0 ? '+' : ''}{item.change}%
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
