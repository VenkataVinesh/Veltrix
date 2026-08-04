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

    const upper = path.map((p, i) => `${i ? 'L' : 'M'}${x(j(i + 1)).toFixed(1)},${y(p.hi).toFixed(1)}`).join('')
    const lowerRev = [...path].reverse()
      .map((p, i) => `L${x(j(path.length - i)).toFixed(1)},${y(p.lo).toFixed(1)}`).join('')
    const band = `${upper}${lowerRev}Z`

    return { histLine, midLine, band, splitX: x(hist.length - 1) }
  }, [history, path])

  if (!geom) {
    return <div className={cn('h-[320px] w-full animate-pulse rounded-2xl bg-elevated/50', className)} />
  }

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="fc-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        <path d={geom.band} fill="url(#fc-band)" />
        <line
          x1={geom.splitX} y1={PAD_T} x2={geom.splitX} y2={H - PAD_B}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
        />
        <path
          d={geom.histLine} fill="none" stroke="#8A9099" strokeWidth="1.75"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
        <path
          d={geom.midLine} fill="none" stroke="var(--primary)" strokeWidth="2.25"
          strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
