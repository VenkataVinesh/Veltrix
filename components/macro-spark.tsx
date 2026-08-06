'use client'

/**
 * Inline sparkline. Deliberately axis-free — it exists to show shape and
 * direction next to a number that already carries the precise value.
 * A baseline is drawn only where zero is meaningful (the yield curve),
 * because "above or below zero" is the whole story for that series.
 */
export function MacroSpark({
  values,
  positive,
  showZero = false,
}: {
  values: number[]
  positive: boolean
  showZero?: boolean
}) {
  if (values.length < 2) return null

  const W = 120
  const H = 32
  const min = Math.min(...values, showZero ? 0 : Infinity)
  const max = Math.max(...values, showZero ? 0 : -Infinity)
  const span = max - min || 1

  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - ((v - min) / span) * H

  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const stroke = positive ? 'var(--color-success)' : 'var(--color-destructive)'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-hidden="true"
      className="overflow-visible"
      preserveAspectRatio="none"
    >
      {showZero && min < 0 && max > 0 && (
        <line
          x1={0}
          x2={W}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2} fill={stroke} />
    </svg>
  )
}
