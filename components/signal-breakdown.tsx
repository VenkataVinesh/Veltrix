'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

/**
 * Honest composite-signal panel. Shows exactly which technical components
 * voted, their measured values, and their weights — nothing narrated,
 * nothing simulated. Replaces the former scripted "multi-agent debate".
 */
export function SignalBreakdown({ symbol = 'SPY', timeframe = '1D' }: { symbol?: string; timeframe?: string }) {
  const { data: signal, isLoading } = useQuery({
    queryKey: ['signal', symbol, timeframe],
    queryFn: () => api.signal(symbol, timeframe),
    refetchInterval: 15_000,
    staleTime: 12_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center font-mono text-[11px] text-muted-foreground">
        Computing {symbol} components…
      </div>
    )
  }
  if (!signal) {
    return (
      <div className="flex h-40 items-center justify-center font-mono text-[11px] text-muted-foreground">
        No signal data for {symbol}
      </div>
    )
  }

  const comps = signal.components ?? []
  const sigColor = signal.signal === 'BUY' ? 'var(--success)' : signal.signal === 'SELL' ? 'var(--destructive)' : 'var(--foreground)'
  const momentumPct = Math.round(((signal.momentum + 1) / 2) * 100) // -1..1 → 0..100

  return (
    <div className="flex flex-col">
      {/* Composite row */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="font-mono text-lg font-bold tabular-nums" style={{ color: sigColor }}>{signal.signal}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {symbol} · {timeframe} composite
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {(signal.momentum >= 0 ? '+' : '') + signal.momentum.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">momentum score</div>
        </div>
      </div>

      {/* Momentum gauge: bearish ← → bullish */}
      <div className="border-b border-border px-4 py-2.5">
        <div className="relative h-1 overflow-hidden rounded-full bg-secondary">
          <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/40" />
          <div
            className="absolute inset-y-0 rounded-full transition-all duration-500"
            style={{
              left: signal.momentum >= 0 ? '50%' : `${momentumPct}%`,
              right: signal.momentum >= 0 ? `${100 - momentumPct}%` : '50%',
              background: signal.momentum >= 0 ? 'var(--success)' : 'var(--destructive)',
            }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
          <span>bearish −1</span>
          <span>0</span>
          <span>bullish +1</span>
        </div>
      </div>

      {/* Component votes */}
      <table className="terminal-table">
        <thead>
          <tr>
            <th>Component</th>
            <th className="text-right">Value</th>
            <th className="text-right">Vote</th>
            <th className="text-right">Wt</th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => (
            <tr key={c.name} title={c.detail}>
              <td className="text-foreground">{c.name}</td>
              <td className="text-right text-muted-foreground">{c.value}</td>
              <td className="text-right">
                <span
                  className={cn(
                    'inline-block rounded-[3px] px-1.5 py-px font-mono text-[10px] font-semibold uppercase',
                    c.vote === 'bullish' && 'bg-success/10 text-success',
                    c.vote === 'bearish' && 'bg-destructive/10 text-destructive',
                    c.vote === 'neutral' && 'bg-secondary text-muted-foreground'
                  )}
                >
                  {c.vote}
                </span>
              </td>
              <td className="text-right text-muted-foreground">{c.weight > 0 ? c.weight.toFixed(1) : '—'}</td>
            </tr>
          ))}
          {comps.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted-foreground">
                Component breakdown unavailable for this feed
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Methodology — every claim traceable */}
      <p className="px-4 py-2.5 font-mono text-[9.5px] leading-relaxed text-muted-foreground/70">
        Composite = weighted sum of indicator votes normalized to [−1, +1]; BUY above +0.3, SELL below −0.3.
        Computed server-side from OHLC data. Not investment advice.
      </p>
    </div>
  )
}
