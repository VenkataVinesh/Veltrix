'use client'

import { useRef, useEffect, useMemo } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, LineSeries, BarSeries, HistogramSeries, type IChartApi, type ISeriesApi, type Time, type CandlestickData, type LineData, type HistogramData, type BarData } from 'lightweight-charts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { realtimeManager } from '@/lib/realtime-manager'
import { buildChartPoints, type OhlcPoint, type ChartPoint } from '@/lib/market-indicators'
import { cn } from '@/lib/utils'

export type ChartMode = 'candles' | 'line' | 'bar'

export interface TradingIndicators {
  volume: boolean
  rsi: boolean
  macd: boolean
  ema: boolean
  sma: boolean
  bollinger: boolean
  volumeProfile: boolean
}

interface TradingChartProps {
  symbol: string
  timeframe: string
  chartMode: ChartMode
  indicators: TradingIndicators
}

const COLORS = {
  text: '#8a8a9a',
  grid: '#1a1a2e',
  up: '#22c55e',
  down: '#ef4444',
  volume: '#3b82f6',
  ema: '#38bdf8',
  sma: '#a855f7',
  bollinger: '#60a5fa',
  crosshair: '#f59e0b',
}

function toLcTime(t: string): Time {
  const n = Number(t)
  if (Number.isFinite(n)) return Math.floor(n) as Time
  // Date string like "2026-02-17"
  const parsed = new Date(t)
  if (!isNaN(parsed.getTime())) return Math.floor(parsed.getTime() / 1000) as Time
  // Fallback: use index as-is
  return 0 as Time
}

export function TradingChart({ symbol, timeframe, chartMode, indicators }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Bar'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bollURef = useRef<ISeriesApi<'Line'> | null>(null)
  const bollLRef = useRef<ISeriesApi<'Line'> | null>(null)

  const queryClient = useQueryClient()
  const channel = `market:${symbol}:${timeframe.toLowerCase()}`

  useEffect(() => {
    realtimeManager.connectIfNeeded()
    const unsub = realtimeManager.subscribe(channel, (payload) => {
      const point = (payload as Record<string, unknown>)?.point as Record<string, unknown> | undefined
      if (!point) return
      queryClient.setQueryData(['ohlc', symbol, timeframe], (current: unknown) => {
        const data = current as { points: Array<Record<string, unknown>> } | undefined
        if (!data?.points?.length) return current
        const points = [...data.points]
        const last = points[points.length - 1]
        if (last?.t === point.t) points[points.length - 1] = point
        else { points.push(point); if (points.length > 300) points.splice(0, points.length - 300) }
        return { ...data, points }
      })
    })
    return () => unsub()
  }, [queryClient, channel, symbol, timeframe])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ohlc', symbol, timeframe],
    queryFn: () => api.ohlc(symbol, timeframe),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const chartData = useMemo(() => buildChartPoints((data?.points ?? []) as OhlcPoint[]), [data])
  const dataSource = data?.source

  // Build series data
  const candleData = useMemo((): CandlestickData[] =>
    chartData.map((p) => ({ time: toLcTime(p.t), open: p.o, high: p.h, low: p.l, close: p.c })), [chartData])

  const lineData = useMemo((): LineData[] =>
    chartData.map((p) => ({ time: toLcTime(p.t), value: p.c })), [chartData])

  const volumeData = useMemo((): HistogramData[] =>
    chartData.map((p) => ({ time: toLcTime(p.t), value: p.v, color: p.c >= p.o ? COLORS.up : COLORS.down })), [chartData])

  const emaData = useMemo((): LineData[] =>
    chartData.filter((p) => p.ema20 != null).map((p) => ({ time: toLcTime(p.t), value: p.ema20! })), [chartData])

  const smaData = useMemo((): LineData[] =>
    chartData.filter((p) => p.sma20 != null).map((p) => ({ time: toLcTime(p.t), value: p.sma20! })), [chartData])

  const bollUData = useMemo((): LineData[] =>
    chartData.filter((p) => p.bollingerUpper != null).map((p) => ({ time: toLcTime(p.t), value: p.bollingerUpper! })), [chartData])

  const bollLData = useMemo((): LineData[] =>
    chartData.filter((p) => p.bollingerLower != null).map((p) => ({ time: toLcTime(p.t), value: p.bollingerLower! })), [chartData])

  // Create chart
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: COLORS.text,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: COLORS.grid, style: LineStyle.Dashed },
        horzLines: { color: COLORS.grid, style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.crosshair },
        horzLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.crosshair },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: COLORS.grid },
      rightPriceScale: { borderColor: COLORS.grid },
      handleScroll: { vertTouchDrag: false },
      autoSize: true,
    })
    chartRef.current = chart

    // Main price series
    if (chartMode === 'candles') seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up, downColor: COLORS.down, borderUpColor: COLORS.up, borderDownColor: COLORS.down, wickUpColor: COLORS.up, wickDownColor: COLORS.down,
    })
    else if (chartMode === 'line') seriesRef.current = chart.addSeries(LineSeries, { color: COLORS.up, lineWidth: 2 })
    else seriesRef.current = chart.addSeries(BarSeries, { upColor: COLORS.up, downColor: COLORS.down })

    // Volume
    if (indicators.volume) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, { color: COLORS.volume, priceFormat: { type: 'volume' } })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    }

    // Indicators
    if (indicators.ema) emaSeriesRef.current = chart.addSeries(LineSeries, { color: COLORS.ema, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    if (indicators.sma) smaSeriesRef.current = chart.addSeries(LineSeries, { color: COLORS.sma, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    if (indicators.bollinger) {
      bollURef.current = chart.addSeries(LineSeries, { color: COLORS.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
      bollLRef.current = chart.addSeries(LineSeries, { color: COLORS.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    }

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      emaSeriesRef.current = null
      smaSeriesRef.current = null
      bollURef.current = null
      bollLRef.current = null
    }
  }, [chartMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Data updates
  useEffect(() => {
    const s = seriesRef.current
    if (!s) return
    if (chartMode === 'candles') (s as ISeriesApi<'Candlestick'>).setData(candleData)
    else if (chartMode === 'line') (s as ISeriesApi<'Line'>).setData(lineData)
    else (s as ISeriesApi<'Bar'>).setData(candleData as unknown as BarData[])

    volumeSeriesRef.current?.setData(volumeData)
    emaSeriesRef.current?.setData(emaData)
    smaSeriesRef.current?.setData(smaData)
    bollURef.current?.setData(bollUData)
    bollLRef.current?.setData(bollLData)

    chartRef.current?.timeScale().fitContent()
  }, [candleData, lineData, volumeData, emaData, smaData, bollUData, bollLData, chartMode])

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-border/60 bg-secondary/20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full border border-primary/40 bg-primary/10" />
          <p className="text-sm text-muted-foreground">Loading {symbol} {timeframe} chart...</p>
        </div>
      </div>
    )
  }

  if (isError || !chartData.length) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="space-y-3 max-w-md">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Chart data unavailable</p>
            <p className="text-sm text-muted-foreground">Unable to load OHLC data for {symbol} on {timeframe}.</p>
          </div>
          <button onClick={() => refetch()} className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">Retry</button>
        </div>
      </div>
    )
  }

  const lastCandle = chartData[chartData.length - 1]

  return (
    <div className="relative h-full min-h-[400px] w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-mono text-muted-foreground backdrop-blur z-10">
        {symbol} · {data?.timeframe?.toUpperCase?.() ?? timeframe} · {dataSource ?? 'market'}
      </div>
      <div className={cn(
        'absolute left-3 bottom-3 rounded-lg border px-3 py-1.5 text-xs font-mono backdrop-blur z-10',
        lastCandle.c >= lastCandle.o ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}>
        ${lastCandle.c.toFixed(2)} · {lastCandle.c >= lastCandle.o ? 'Bullish' : 'Bearish'}
      </div>
    </div>
  )
}
