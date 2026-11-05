'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  AreaSeries, CandlestickSeries,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts'

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

// Mirrors the tokens in app/globals.css (canvas cannot read CSS variables).
const C = {
  line: '#C6F24E',
  fillTop: 'rgba(198,242,78,0.18)',
  fillBottom: 'rgba(198,242,78,0.0)',
  up: '#3DD68C',
  down: '#FF6B6B',
  grid: '#1A1F26',
  text: '#7D8691',
  crosshair: 'rgba(232,235,239,0.35)',
  label: '#1D222A',
}

export function PriceChart({
  candles,
  mode = 'area',
  height = 380,
  onHover,
}: {
  candles: Candle[]
  mode?: 'area' | 'candles'
  /** Pixels, or any CSS length (e.g. '100%' to fill a sized parent). */
  height?: number | string
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
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
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
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, barSpacing: 8, fixLeftEdge: true, fixRightEdge: true },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      handleScroll: { vertTouchDrag: false },
      localization: {
        // Whole numbers for large prices, more precision only for sub-dollar assets.
        priceFormatter: (p: number) =>
          p >= 1000 ? Math.round(p).toLocaleString('en-US')
          : p >= 1 ? p.toFixed(2)
          : p.toPrecision(4),
      },
    })
    chartRef.current = chart

    seriesRef.current = mode === 'candles'
      ? chart.addSeries(CandlestickSeries, {
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up, wickDownColor: C.down,
        })
      : chart.addSeries(AreaSeries, {
          lineColor: C.line, lineWidth: 2,
          topColor: C.fillTop, bottomColor: C.fillBottom,
          priceLineColor: C.line, lastValueVisible: true,
        })

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return hoverRef.current?.(null)
      hoverRef.current?.(byTime.current.get(param.time as number) ?? null)
    })

    setReady(true)
  }, [mode])

  const buildRef = useRef(build)
  useEffect(() => { buildRef.current = build }, [build])

  // Build from the element's current box straight away — don't wait on the
  // ResizeObserver's first callback, which some embedded/headless browsers
  // never deliver. RO then only handles genuine resizes.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const attempt = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 10 && r.height > 10) { buildRef.current(r.width, r.height); return true }
      return false
    }
    if (!attempt()) requestAnimationFrame(attempt)

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
