'use client'

import dynamic from 'next/dynamic'
import type { ChartMode, TradingIndicators } from '@/components/trading-chart'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

const TradingChart = dynamic(
  () => import('@/components/trading-chart').then((mod) => mod.TradingChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] rounded-lg border border-white/[0.06] bg-[#050507]" />
    ),
  }
)

interface ChartWrapperProps {
  symbol?: string
  timeframe?: string
  chartMode?: ChartMode
  indicators?: TradingIndicators
  height?: number
}

export function ChartWrapper({
  symbol = 'SPY',
  timeframe = 'daily',
  chartMode = 'candles',
  indicators = { volume: true, rsi: false, macd: false, ema: true, sma: true, bollinger: true, volumeProfile: false },
  height = 300,
}: ChartWrapperProps) {
  // If a symbol prop is not provided, attempt to fetch a default from market quotes
  const { data: quotes } = useQuery({
    queryKey: ['quotes', 'default'],
    queryFn: () => api.quotes(),
    staleTime: 60_000,
    enabled: !symbol,
  })
  const effectiveSymbol = symbol || (Array.isArray(quotes) && quotes.length ? quotes[0].symbol : 'SPY')

  return (
    <div className="premium-card overflow-hidden p-2">
      <TradingChart
        symbol={effectiveSymbol}
        timeframe={timeframe}
        chartMode={chartMode}
        indicators={indicators}
        height={height}
      />
    </div>
  )
}
