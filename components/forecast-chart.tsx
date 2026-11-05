'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface ForecastPoint { t: number; mid: number; lo: number; hi: number }

const W = 1000, H = 320, PAD_T = 16, PAD_B = 28

/**
 * History plus a forecast fan.
 *
 * Drawn as a plain SVG rather than through lightweight-charts because the
 * band is the point: the widening cone is the honest part of the output,
 * and it should be impossible to read the median line without also seeing
 * how little confidence sits behind it.
 */
export function ForecastChart({
  history,
  path,
  className,
}: {
  history: number[]
  path: ForecastPoint[]
  className?: string
}) {
  const geom = useMemo(() => {
    if (!path.length) return null

    // Keep history proportionate to the forecast so the cone stays readable.
    const hist = history.slice(-Math.max(40, path.length * 3))
    const total = hist.length + path.length
    if (total < 4) return null

    const all = [...hist, ...path.map((p) => p.hi), ...path.map((p) => p.lo)]
    const min = Math.min(...all)
    const max = Math.max(...all)
    const span = max - min || 1

    const x = (i: number) => (i / (total - 1)) * W
    const y = (v: number) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B)

    const histLine = hist.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')

    const j = (i: number) => hist.length - 1 + i
    const midLine =
      `M${x(hist.length - 1).toFixed(1)},${y(hist[hist.length - 1]).toFixed(1)}` +
      path.map((p, i) => `L${x(j(i + 1)).toFixed(1)},${y(p.mid).toFixed(1)}`).join('')

    // The band fans out from the last observed price, so it starts at zero width at "now".
    const x0 = x(hist.length - 1).toFixed(1), y0 = y(hist[hist.length - 1]).toFixed(1)
    const upper = `M${x0},${y0}` + path.map((p, i) => `L${x(j(i + 1)).toFixed(1)},${y(p.hi).toFixed(1)}`).join('')
    const lowerRev = [...path].reverse()
      .map((p, i) => `L${x(j(path.length - i)).toFixed(1)},${y(p.lo).toFixed(1)}`).join('')
    const band = `${upper}${lowerRev}L${x0},${y0}Z`

    // Five evenly spaced price ticks for the right-hand axis.
    const ticks = Array.from({ length: 5 }, (_, k) => {
      const v = min + (span * k) / 4
      return { v, top: (y(v) / H) * 100 }
    })
    const last = path[path.length - 1]
    return {
      histLine, midLine, band, splitX: x(hist.length - 1), ticks,
      splitPct: (x(hist.length - 1) / W) * 100,
      end: { lo: last.lo, hi: last.hi, mid: last.mid, loTop: (y(last.lo) / H) * 100, hiTop: (y(last.hi) / H) * 100 },
    }
  }, [history, path])

  if (!geom) {
    return <div className={cn('h-[320px] w-full animate-pulse rounded-2xl bg-elevated/50', className)} />
  }

  const fmt = (v: number) => v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 1 ? v.toFixed(2) : v.toPrecision(3)

  return (
    <div className={cn('relative flex flex-col', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-[11px] text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-primary/30" />95% band (calibrated)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-secondary-foreground" />median (≈ random walk)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-muted-foreground" />history</span>
      </div>
      <div className="relative min-h-0 flex-1 pr-16">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="fc-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        <path d={geom.band} fill="url(#fc-band)" />
        <line
          x1={geom.splitX} y1={PAD_T} x2={geom.splitX} y2={H - PAD_B}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
        />
        <path
          d={geom.histLine} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.75"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
        <path
          d={geom.midLine} fill="none" stroke="var(--secondary-foreground)" strokeWidth="1.75"
          strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Axis and annotations as HTML so text is crisp and never stretched */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 text-[10px] text-muted-foreground" aria-hidden="true">
        {geom.ticks.map((t) => (
          <span key={t.v} className="tnum absolute right-2 -translate-y-1/2" style={{ top: `${t.top}%` }}>{fmt(t.v)}</span>
        ))}
      </div>
      <span className="pointer-events-none absolute top-1 -translate-x-1/2 rounded bg-elevated px-1.5 py-0.5 text-[10px] text-secondary-foreground" style={{ left: `calc((100% - 4rem) * ${(geom.splitPct / 100).toFixed(4)})` }} aria-hidden="true">now</span>
      </div>
      <p className="sr-only">
        Forecast band at the horizon: {fmt(geom.end.lo)} to {fmt(geom.end.hi)}, median {fmt(geom.end.mid)}.
      </p>
    </div>
  )
}
