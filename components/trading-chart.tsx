'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, LineSeries, BarSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type Time, type MouseEventParams,
  type CandlestickData, type LineData, type HistogramData, type BarData,
} from 'lightweight-charts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useWebSocket } from '@/lib/use-websocket'
import { buildChartPoints, type OhlcPoint, type ChartPoint } from '@/lib/market-indicators'

export type ChartMode = 'candles' | 'line' | 'bar'

export interface TradingIndicators {
  volume: boolean; rsi: boolean; macd: boolean
  ema: boolean; sma: boolean; bollinger: boolean
}

interface Props { symbol: string; timeframe: string; chartMode: ChartMode; indicators: TradingIndicators; height?: number }

/* Terminal palette — matches globals.css tokens */
const C = {
  text: '#8b93a1', grid: '#161b22',
  up: '#2ebd85', down: '#f6465d',
  upSoft: 'rgba(46,189,133,0.35)', downSoft: 'rgba(246,70,93,0.35)',
  ema: '#58a6ff', sma: '#a78bfa', bollinger: 'rgba(221,227,236,0.28)',
  rsi: '#f2a33c', macd: '#58a6ff', macdSignal: '#f2a33c',
  xhair: 'rgba(221,227,236,0.45)', labelBg: '#151a20',
}

const BASE_TS = Math.floor(Date.now() / 1000)

function t2lc(t: string | number, idx?: number): Time {
  const n = Number(t)
  if (Number.isFinite(n) && n > 946_684_800) return Math.floor(n) as Time
  if (Number.isFinite(n) && n >= 0 && n < 10_000) {
    return (BASE_TS - (9999 - Math.floor(n)) * 86_400) as Time
  }
  const d = new Date(String(t))
  if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000) as Time
  return (BASE_TS - ((idx ?? 0) * 86_400)) as Time
}

const fmt = (v: number | undefined | null, dp = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(dp))

export function TradingChart({ symbol, timeframe, chartMode, indicators, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Bar'> | null>(null)
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const buRef = useRef<ISeriesApi<'Line'> | null>(null)
  const blRef = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSigRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<ChartPoint | null>(null)
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
    return () => { unsubscribe() }
  }, [subscribe, symbol, timeframe, qc])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ohlc', symbol, timeframe],
    queryFn: () => api.ohlc(symbol, timeframe),
    staleTime: 15_000, refetchInterval: 30_000,
  })

  const pts = useMemo(() => buildChartPoints((data?.points ?? []) as OhlcPoint[]), [data])
  const timeIndex = useMemo(() => {
    const m = new Map<number, ChartPoint>()
    pts.forEach((p, i) => m.set(t2lc(p.t, i) as number, p))
    return m
  }, [pts])

  const candleD = useMemo((): CandlestickData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), open: p.o, high: p.h, low: p.l, close: p.c })), [pts])
  const lineD = useMemo((): LineData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), value: p.c })), [pts])
  const volD = useMemo((): HistogramData[] => pts.map((p, i) => ({ time: t2lc(p.t, i), value: p.v, color: p.c >= p.o ? C.upSoft : C.downSoft })), [pts])
  const emaD = useMemo((): LineData[] => pts.filter(p => p.ema20 != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.ema20! })), [pts])
  const smaD = useMemo((): LineData[] => pts.filter(p => p.sma20 != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.sma20! })), [pts])
  const buD = useMemo((): LineData[] => pts.filter(p => p.bollingerUpper != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.bollingerUpper! })), [pts])
  const blD = useMemo((): LineData[] => pts.filter(p => p.bollingerLower != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.bollingerLower! })), [pts])
  const rsiD = useMemo((): LineData[] => pts.filter(p => p.rsi14 != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.rsi14! })), [pts])
  const macdD = useMemo((): LineData[] => pts.filter(p => p.macd != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.macd! })), [pts])
  const macdSigD = useMemo((): LineData[] => pts.filter(p => p.macdSignal != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.macdSignal! })), [pts])
  const macdHistD = useMemo((): HistogramData[] => pts.filter(p => p.macdHistogram != null).map((p, i) => ({ time: t2lc(p.t, i), value: p.macdHistogram!, color: (p.macdHistogram ?? 0) >= 0 ? C.upSoft : C.downSoft })), [pts])

  const destroy = useCallback(() => {
    try { chartRef.current?.remove() } catch {}
    chartRef.current = null; mainRef.current = null; volRef.current = null
    emaRef.current = null; smaRef.current = null; buRef.current = null; blRef.current = null
    rsiRef.current = null; macdRef.current = null; macdSigRef.current = null; macdHistRef.current = null
    setReady(false)
  }, [])

  const build = useCallback((w: number, h: number) => {
    const el = containerRef.current
    if (!el || chartRef.current || w < 10 || h < 10) return

    const chart = createChart(el, {
      width: Math.floor(w), height: Math.floor(h),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: C.text, fontSize: 11,
        fontFamily: "var(--font-jbmono), 'JetBrains Mono', monospace",
        panes: { separatorColor: C.grid, separatorHoverColor: 'rgba(242,163,60,0.25)', enableResize: true },
      },
      grid: { vertLines: { color: C.grid, style: LineStyle.Solid }, horzLines: { color: C.grid, style: LineStyle.Solid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.xhair, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: C.labelBg },
        horzLine: { color: C.xhair, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: C.labelBg },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: C.grid, barSpacing: 7, rightOffset: 3 },
      rightPriceScale: { borderColor: C.grid },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart

    if (chartMode === 'candles') mainRef.current = chart.addSeries(CandlestickSeries, { upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down })
    else if (chartMode === 'line') mainRef.current = chart.addSeries(LineSeries, { color: C.ema, lineWidth: 2 })
    else mainRef.current = chart.addSeries(BarSeries, { upColor: C.up, downColor: C.down })

    if (indicators.volume) { volRef.current = chart.addSeries(HistogramSeries, { color: C.upSoft, priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false }); chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } }) }
    if (indicators.ema) emaRef.current = chart.addSeries(LineSeries, { color: C.ema, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
    if (indicators.sma) smaRef.current = chart.addSeries(LineSeries, { color: C.sma, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
    if (indicators.bollinger) {
      buRef.current = chart.addSeries(LineSeries, { color: C.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
      blRef.current = chart.addSeries(LineSeries, { color: C.bollinger, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
    }

    /* Sub-panes: RSI (pane 1), MACD (next pane) — real, not decorative */
    let paneIdx = 1
    if (indicators.rsi) {
      rsiRef.current = chart.addSeries(LineSeries, { color: C.rsi, lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, paneIdx)
      rsiRef.current.createPriceLine({ price: 70, color: 'rgba(246,70,93,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
      rsiRef.current.createPriceLine({ price: 30, color: 'rgba(46,189,133,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
      paneIdx += 1
    }
    if (indicators.macd) {
      macdHistRef.current = chart.addSeries(HistogramSeries, { color: C.upSoft, priceLineVisible: false, lastValueVisible: false }, paneIdx)
      macdRef.current = chart.addSeries(LineSeries, { color: C.macd, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIdx)
      macdSigRef.current = chart.addSeries(LineSeries, { color: C.macdSignal, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIdx)
      paneIdx += 1
    }
    // Size sub-panes: main pane keeps ~65% when both are on
    try {
      const panes = chart.panes()
      if (panes.length > 1) {
        const subH = Math.max(64, Math.floor(h * (panes.length === 2 ? 0.22 : 0.17)))
        for (let i = 1; i < panes.length; i += 1) panes[i].setHeight(subH)
      }
    } catch { /* pane sizing best-effort */ }

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time) { setHover(null); return }
      setHover(timeIndex.get(param.time as number) ?? null)
    })

    setReady(true)
  }, [chartMode, indicators, timeIndex]) // eslint-disable-line

  const buildRef = useRef(build)
  useEffect(() => { buildRef.current = build }, [build])

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

  // Rebuild when structure changes (mode or pane toggles)
  const structureKey = `${chartMode}:${indicators.rsi}:${indicators.macd}:${indicators.volume}:${indicators.ema}:${indicators.sma}:${indicators.bollinger}`
  useEffect(() => {
    destroy()
    const el = containerRef.current
    if (!el) return
    const doRebuild = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 10 && rect.height > 10) build(rect.width, rect.height)
      else requestAnimationFrame(() => {
        const r2 = el.getBoundingClientRect()
        if (r2.width > 10 && r2.height > 10) build(r2.width, r2.height)
      })
    }
    doRebuild()
  }, [structureKey]) // eslint-disable-line

  // Push data
  useEffect(() => {
    if (!ready || !mainRef.current || !pts.length) return
    try {
      if (chartMode === 'candles') (mainRef.current as ISeriesApi<'Candlestick'>).setData(candleD)
      else if (chartMode === 'line') (mainRef.current as ISeriesApi<'Line'>).setData(lineD)
      else (mainRef.current as ISeriesApi<'Bar'>).setData(candleD as unknown as BarData[])
      volRef.current?.setData(volD); emaRef.current?.setData(emaD); smaRef.current?.setData(smaD)
      buRef.current?.setData(buD); blRef.current?.setData(blD)
      rsiRef.current?.setData(rsiD)
      macdRef.current?.setData(macdD); macdSigRef.current?.setData(macdSigD); macdHistRef.current?.setData(macdHistD)
      chartRef.current?.timeScale().fitContent()
    } catch { /* stale refs */ }
  }, [ready, candleD, lineD, volD, emaD, smaD, buD, blD, rsiD, macdD, macdSigD, macdHistD, chartMode, pts.length])

  const last = pts.length ? pts[pts.length - 1] : null
  const legend = hover ?? last
  const legendUp = legend ? legend.c >= legend.o : true

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height, background: 'var(--card)' }}>

      {isLoading && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-card">
          <div className="text-center">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
            <p className="font-mono text-[11px] text-muted-foreground">Loading {symbol} · {timeframe}…</p>
          </div>
        </div>
      )}

      {!isLoading && (isError || !pts.length) && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-card">
          <div className="px-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive/70" />
            <p className="mb-3 font-mono text-xs text-muted-foreground">No chart data · {symbol} {timeframe}</p>
            <button
              onClick={() => refetch()}
              className="mx-auto flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* OHLC legend — crosshair-tracked, terminal-style */}
      {legend && !isLoading && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px] leading-tight">
          <span className="text-foreground">{symbol}</span>
          <span className="text-muted-foreground">{timeframe.toUpperCase()}</span>
          <span className="text-muted-foreground">O <span style={{ color: legendUp ? C.up : C.down }}>{fmt(legend.o)}</span></span>
          <span className="text-muted-foreground">H <span style={{ color: legendUp ? C.up : C.down }}>{fmt(legend.h)}</span></span>
          <span className="text-muted-foreground">L <span style={{ color: legendUp ? C.up : C.down }}>{fmt(legend.l)}</span></span>
          <span className="text-muted-foreground">C <span style={{ color: legendUp ? C.up : C.down }}>{fmt(legend.c)}</span></span>
          {indicators.volume && <span className="text-muted-foreground">V <span className="text-foreground">{legend.v >= 1e6 ? `${(legend.v / 1e6).toFixed(2)}M` : legend.v >= 1e3 ? `${(legend.v / 1e3).toFixed(1)}K` : fmt(legend.v, 0)}</span></span>}
          {indicators.ema && legend.ema20 != null && <span style={{ color: C.ema }}>EMA20 {fmt(legend.ema20)}</span>}
          {indicators.sma && legend.sma20 != null && <span style={{ color: C.sma }}>SMA20 {fmt(legend.sma20)}</span>}
          {indicators.rsi && legend.rsi14 != null && <span style={{ color: C.rsi }}>RSI {fmt(legend.rsi14, 1)}</span>}
          {indicators.macd && legend.macd != null && <span style={{ color: C.macd }}>MACD {fmt(legend.macd, 3)}</span>}
        </div>
      )}

      {/* Data source badge */}
      {last && !isLoading && (
        <div className="pointer-events-none absolute bottom-1.5 left-2 z-10 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/70">
          {data?.source ?? 'live'}
        </div>
      )}
    </div>
  )
}
