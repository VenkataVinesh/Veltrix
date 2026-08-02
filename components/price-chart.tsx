'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  AreaSeries, CandlestickSeries,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts'

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

const C = {
  lime: '#C6F24E',
  limeFillTop: 'rgba(198,242,78,0.22)',
  limeFillBottom: 'rgba(198,242,78,0.01)',
  down: '#F87171',
  grid: '#1C2128',
  text: '#8A9099',
  crosshair: 'rgba(255,255,255,0.35)',
  label: '#1A1E24',
}

export function PriceChart({
  candles,
  mode = 'area',
  height = 380,
  onHover,
}: {
  candles: Candle[]
  mode?: 'area' | 'candles'
  height?: number
  onHover?: (c: Candle | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null)
  const [ready, setReady] = useState(false)

  const hoverRef = useRef(onHover)
  useEffect(() => { hoverRef.current = onHover }, [onHover])

  const byTime = useRef(new Map<number, Candle>())
  byTime.current = new Map(candles.map((c) => [c.t, c]))

  const build = useCallback((w: number, h: number) => {
    const el = wrapRef.current
    if (!el || chartRef.current || w < 10 || h < 10) return

    const chart = createChart(el, {
      width: Math.floor(w),
      height: Math.floor(h),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: C.text,
        fontSize: 11,
        fontFamily: 'var(--font-inter), Inter, sans-serif',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: C.grid, style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: C.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label },
        horzLine: { color: C.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label },
      },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, barSpacing: 8 },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart

    seriesRef.current = mode === 'candles'
      ? chart.addSeries(CandlestickSeries, {
          upColor: C.lime, downColor: C.down,
          borderUpColor: C.lime, borderDownColor: C.down,
          wickUpColor: C.lime, wickDownColor: C.down,
        })
      : chart.addSeries(AreaSeries, {
          lineColor: C.lime, lineWidth: 2,
          topColor: C.limeFillTop, bottomColor: C.limeFillBottom,
        })

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return hoverRef.current?.(null)
      hoverRef.current?.(byTime.current.get(param.time as number) ?? null)
    })

    setReady(true)
  }, [mode])

  const buildRef = useRef(build)
  useEffect(() => { buildRef.current = build }, [build])

  // Observe size; build once we have real dimensions
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect
      if (chartRef.current) chartRef.current.resize(Math.floor(width), Math.floor(h))
      else buildRef.current(width, h)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      try { chartRef.current?.remove() } catch { /* already disposed */ }
      chartRef.current = null
      seriesRef.current = null
      setReady(false)
    }
  }, [])

  // Rebuild when the series type changes
  useEffect(() => {
    if (!chartRef.current) return
    try { chartRef.current.remove() } catch { /* already disposed */ }
    chartRef.current = null
    seriesRef.current = null
    setReady(false)
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect && rect.width > 10) build(rect.width, rect.height)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push data
  useEffect(() => {
    if (!ready || !seriesRef.current || !candles.length) return
    try {
      if (mode === 'candles') {
        ;(seriesRef.current as ISeriesApi<'Candlestick'>).setData(
          candles.map((c) => ({ time: c.t as Time, open: c.o, high: c.h, low: c.l, close: c.c }))
        )
      } else {
        ;(seriesRef.current as ISeriesApi<'Area'>).setData(
          candles.map((c) => ({ time: c.t as Time, value: c.c }))
        )
      }
      chartRef.current?.timeScale().fitContent()
    } catch { /* stale handle after unmount */ }
  }, [ready, candles, mode])

  return <div ref={wrapRef} style={{ width: '100%', height }} />
}
