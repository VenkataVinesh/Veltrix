'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, LineSeries, BarSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type Time,
  type CandlestickData, type LineData, type HistogramData, type BarData,
} from 'lightweight-charts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useWebSocket } from '@/lib/use-websocket'
import { buildChartPoints, type OhlcPoint } from '@/lib/market-indicators'

export type ChartMode = 'candles' | 'line' | 'bar'

export interface TradingIndicators {
  volume: boolean; rsi: boolean; macd: boolean
  ema: boolean; sma: boolean; bollinger: boolean; volumeProfile: boolean
}

interface Props { symbol: string; timeframe: string; chartMode: ChartMode; indicators: TradingIndicators; height?: number }

const C = { text: '#7f8794', grid: '#171b24', up: '#61f2b2', down: '#ff6b7a', ema: '#8fd8ff', sma: '#a78bfa', bollinger: '#dce8ff', xhair: '#8fd8ff' }

const BASE_TS = Math.floor(Date.now() / 1000)

function t2lc(t: string | number, idx?: number): Time {
  const n = Number(t)
  // Real unix timestamp (> year 2000)
  if (Number.isFinite(n) && n > 946_684_800) return Math.floor(n) as Time
  // Simulated sequential index from backend (e.g. "0","1",.."59")
  if (Number.isFinite(n) && n >= 0 && n < 10_000) {
    // Map to real daily timestamps going backwards from today
    return (BASE_TS - (9999 - Math.floor(n)) * 86_400) as Time
  }
  // ISO date string
  const d = new Date(String(t))
  if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000) as Time
  // Fallback using index
  return (BASE_TS - ((idx ?? 0) * 86_400)) as Time
}

export function TradingChart({ symbol, timeframe, chartMode, indicators, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Bar'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const buRef = useRef<ISeriesApi<'Line'> | null>(null)
  const blRef = useRef<ISeriesApi<'Line'> | null>(null)
  const [ready, setReady] = useState(false)
  const qc = useQueryClient()
  const { subscribe } = useWebSocket()

  useEffect(() => {
    const channel = `market:${symbol}:${timeframe.toLowerCase()}`
    const unsubscribe = subscribe(channel, (p) => {
      const pt = (p as Record<string, unknown>)?.point as Record<string, unknown> | undefined
      if (!pt) return
      qc.setQueryData(['ohlc', symbol, timeframe], (cur: unknown) => {
        const d = cur as { points: unknown[] } | undefined
        if (!d?.points?.length) return cur
        const pts = [...d.points] as Record<string, unknown>[]
        const last = pts[pts.length - 1]
        if (last?.t === pt.t) pts[pts.length - 1] = pt
        else { pts.push(pt); if (pts.length > 300) pts.splice(0, pts.length - 300) }
        return { ...d, points: pts }
      })
    })
    return () => {
      unsubscribe()
    }
  }, [subscribe, symbol, timeframe, qc])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ohlc', symbol, timeframe],
    queryFn: () => api.ohlc(symbol, timeframe),
    staleTime: 15_000, refetchInterval: 30_000,
  })

  const pts = useMemo(() => buildChartPoints((data?.points ?? []) as OhlcPoint[]), [data])

  const candleD = useMemo((): CandlestickData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), open: p.o, high: p.h, low: p.l, close: p.c })), [pts])
  const lineD = useMemo((): LineData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), value: p.c })), [pts])
  const volD = useMemo((): HistogramData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), value: p.v, color: p.c >= p.o ? '#61f2b255' : '#ff6b7a55' })), [pts])
  const emaD = useMemo((): LineData[] => pts.filter(p => p.ema20 != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.ema20! })), [pts])
  const smaD = useMemo((): LineData[] => pts.filter(p => p.sma20 != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.sma20! })), [pts])
  const buD = useMemo((): LineData[] => pts.filter(p => p.bollingerUpper != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.bollingerUpper! })), [pts])
  const blD = useMemo((): LineData[] => pts.filter(p => p.bollingerLower != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.bollingerLower! })), [pts])

  const destroy = useCallback(() => {
    try { chartRef.current?.remove() } catch {}
    chartRef.current = null; mainRef.current = null; volRef.current = null
    emaRef.current = null; smaRef.current = null; buRef.current = null; blRef.current = null
    setReady(false)
  }, [])

  const build = useCallback((w: number, h: number) => {
    const el = containerRef.current
    if (!el || chartRef.current || w < 10 || h < 10) return

    const chart = createChart(el, {
      width: Math.floor(w), height: Math.floor(h),
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: C.grid, style: LineStyle.Dashed }, horzLines: { color: C.grid, style: LineStyle.Dashed } },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: C.xhair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0c0c11' }, horzLine: { color: C.xhair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0c0c11' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: C.grid, barSpacing: 8 },
      rightPriceScale: { borderColor: C.grid },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart

    if (chartMode === 'candles') mainRef.current = chart.addSeries(CandlestickSeries, { upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down })
    else if (chartMode === 'line') mainRef.current = chart.addSeries(LineSeries, { color: C.up, lineWidth: 2 })
    else mainRef.current = chart.addSeries(BarSeries, { upColor: C.up, downColor: C.down })

    if (indicators.volume) { volRef.current = chart.addSeries(HistogramSeries, { color: '#8fd8ff33', priceFormat: { type: 'volume' }, priceScaleId: 'vol' }); chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } }) }
    if (indicators.ema) emaRef.current = chart.addSeries(LineSeries, { color: C.ema, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    if (indicators.sma) smaRef.current = chart.addSeries(LineSeries, { color: C.sma, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    if (indicators.bollinger) { buRef.current = chart.addSeries(LineSeries, { color: C.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false }); blRef.current = chart.addSeries(LineSeries, { color: C.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false }) }

    setReady(true)
  }, [chartMode, indicators]) // eslint-disable-line

  // Keep a stable ref to build so ResizeObserver always calls the latest version
  const buildRef = useRef(build)
  useEffect(() => { buildRef.current = build }, [build])

  // ResizeObserver on the container div (always mounted)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]; if (!e) return
      const { width, height } = e.contentRect
      if (chartRef.current) { chartRef.current.resize(Math.floor(width), Math.floor(height)) }
      else { buildRef.current(width, height) }
    })
    ro.observe(el)
    return () => { ro.disconnect(); destroy() }
  }, []) // eslint-disable-line

  // Rebuild on chartMode change
  useEffect(() => {
    destroy()
    const el = containerRef.current
    if (!el) return
    // Use getBoundingClientRect which always returns the actual rendered rect
    const doRebuild = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 10 && rect.height > 10) {
        build(rect.width, rect.height)
      } else {
        // Fall back to a rAF if not yet painted
        requestAnimationFrame(() => {
          const r2 = el.getBoundingClientRect()
          if (r2.width > 10 && r2.height > 10) build(r2.width, r2.height)
        })
      }
    }
    doRebuild()
  }, [chartMode]) // eslint-disable-line

  // Push data
  useEffect(() => {
    if (!ready || !mainRef.current || !pts.length) return
    try {
      if (chartMode === 'candles') (mainRef.current as ISeriesApi<'Candlestick'>).setData(candleD)
      else if (chartMode === 'line') (mainRef.current as ISeriesApi<'Line'>).setData(lineD)
      else (mainRef.current as ISeriesApi<'Bar'>).setData(candleD as unknown as BarData[])
      volRef.current?.setData(volD); emaRef.current?.setData(emaD); smaRef.current?.setData(smaD)
      buRef.current?.setData(buD); blRef.current?.setData(blD)
      chartRef.current?.timeScale().fitContent()
    } catch { /* stale refs */ }
  }, [ready, candleD, lineD, volD, emaD, smaD, buD, blD, chartMode, pts.length])

  const last = pts.length ? pts[pts.length - 1] : null
  const isUp = last ? last.c >= last.o : true

  return (
    // containerRef is ALWAYS mounted — loading/error overlaid on top
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height, background: 'linear-gradient(180deg,#050507,#09090b)' }}>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050507' }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 className="w-6 h-6 animate-spin text-[#8fd8ff] mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-mono">Loading {symbol} {timeframe}...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {!isLoading && (isError || !pts.length) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050507' }}>
          <div style={{ textAlign: 'center', padding: '0 24px' }}>
            <AlertTriangle className="w-7 h-7 text-[#ff6b7a]/60 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No chart data · {symbol} {timeframe}</p>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1a1a28' }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Badges (only when data present) */}
      {last && !isLoading && (
        <>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(5,5,7,0.74)', backdropFilter: 'blur(12px)', border: '1px solid rgba(220,232,255,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', color: '#7f8794' }}>
            {symbol} · {timeframe.toUpperCase()} · {data?.source ?? 'live'}
          </div>
          <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, background: isUp ? 'rgba(97,242,178,0.08)' : 'rgba(255,107,122,0.08)', border: `1px solid ${isUp ? '#61f2b244' : '#ff6b7a44'}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: isUp ? '#61f2b2' : '#ff6b7a' }}>
            ${last.c.toFixed(2)} {isUp ? '▲' : '▼'}
          </div>
        </>
      )}
    </div>
  )
}
