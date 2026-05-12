'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export function LiveQuote({ symbol }: { symbol: string }) {
  const { data: quotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    refetchInterval: 8000,
  })

  const quote = quotes?.find((q) => q.symbol === symbol)

  if (!quote) {
    return (
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{symbol}</h1>
        <p className="text-sm text-muted-foreground mt-1">Loading live quote...</p>
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h1 className="text-3xl font-bold">{quote.symbol}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Provider: {quote.provider}
        </p>
      </div>
      <div className="text-right">
        <div className="font-mono text-3xl font-bold">${quote.price.toFixed(2)}</div>
        <div className={cn('inline-flex items-center gap-1 font-mono text-sm', quote.change >= 0 ? 'text-success' : 'text-destructive')}>
          {quote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {quote.change >= 0 ? '+' : ''}
          {quote.change}%
        </div>
      </div>
    </div>
  )
}
