'use client'

import Link from 'next/link'
import { ExternalLink, ShieldCheck, Scale } from 'lucide-react'
import { CALIBRATION, DIRECTION, EVALUATION_DOC, REJECTED_MODELS } from '@/lib/evaluation'
import { cn } from '@/lib/utils'

const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`

/**
 * The product's identity, as a panel: the forecast has no directional edge,
 * and the interval band is what is calibrated. Every figure is from
 * docs/FORECAST-EVALUATION.md via lib/evaluation.ts.
 */
export function EdgeReport({ compact = false, className }: { compact?: boolean; className?: string }) {
  const lo = 0.44, hi = 0.56 // axis for the hit-rate strip
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const ci = (1.96 * DIRECTION.sePp) / 100

  return (
    <section
      id="evaluation"
      aria-labelledby="edge-title"
      className={cn('card-surface overflow-hidden', className)}
    >
      <header className="panel-head">
        <h2 id="edge-title" className="eyebrow">Edge report · measured offline</h2>
        <a
          href={EVALUATION_DOC}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Method <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </header>

      <div className={cn('grid gap-px bg-border', compact ? 'md:grid-cols-2 lg:grid-cols-1' : 'lg:grid-cols-2')}>
        {/* Direction */}
        <div className="bg-card p-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-warning" aria-hidden="true" />
            <span className="text-xs font-medium text-secondary-foreground">Direction of the midline</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="figure figure-xl text-foreground">{pct(DIRECTION.hitRate)}</span>
            <span className="chip chip-warn">{DIRECTION.verdict}</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {DIRECTION.correct.toLocaleString('en-US')}/{DIRECTION.calls.toLocaleString('en-US')} walk-forward calls ·
            SE {DIRECTION.sePp}pp · z = {DIRECTION.z} against a fair coin
          </p>

          {/* Hit-rate strip: 50% line, 95% CI, per-symbol dots */}
          <div className="mt-4" aria-hidden="true">
            <div className="relative h-8">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm bg-warning/25"
                style={{ left: x(DIRECTION.hitRate - ci), width: `calc(${x(DIRECTION.hitRate + ci)} - ${x(DIRECTION.hitRate - ci)})` }}
              />
              <div className="absolute inset-y-0 w-px bg-muted-foreground" style={{ left: x(0.5) }} />
              {!compact && DIRECTION.perSymbol.map((s) => (
                <span
                  key={s.symbol}
                  title={`${s.symbol} ${pct(s.hitRate)} (n=${s.n})`}
                  className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary-foreground"
                  style={{ left: x(s.hitRate) }}
                />
              ))}
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-warning"
                style={{ left: x(DIRECTION.hitRate) }}
              />
            </div>
            <div className="tnum flex justify-between text-[10px] text-muted-foreground">
              <span>44%</span><span>50% = coin flip</span><span>56%</span>
            </div>
          </div>
          {!compact && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {REJECTED_MODELS.models.join(' and ')} were built, backtested and cut: no
              better than this, and {REJECTED_MODELS.slowdown} slower.
            </p>
          )}
        </div>

        {/* Calibration */}
        <div className="bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-xs font-medium text-secondary-foreground">95% interval band</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="figure figure-xl text-foreground">{pct(CALIBRATION.garch.coverage, 2)}</span>
            <span className="chip chip-up">CALIBRATED</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            coverage over {CALIBRATION.tests.toLocaleString('en-US')} held-out 5-day forecasts, target 95%
          </p>

          <dl className="mt-4 space-y-2.5">
            {([
              { k: 'EWMA, before', v: CALIBRATION.ewma.coverage, tone: 'bg-destructive', w: CALIBRATION.ewma.widthPct },
              { k: 'GARCH(1,1), now', v: CALIBRATION.garch.coverage, tone: 'bg-success', w: CALIBRATION.garch.widthPct },
            ]).map((r) => (
              <div key={r.k}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="whitespace-nowrap text-secondary-foreground">{r.k}</dt>
                  <dd className="tnum whitespace-nowrap text-foreground">
                    {pct(r.v, 2)}{!compact && <span className="text-muted-foreground"> · band {r.w}% of price</span>}
                  </dd>
                </div>
                {/* Axis 85%–100%, target marker at 95% */}
                <div className="relative mt-1 h-1.5 rounded-full bg-elevated" aria-hidden="true">
                  <div className={cn('absolute inset-y-0 left-0 rounded-full', r.tone)} style={{ width: `${((r.v - 0.85) / 0.15) * 100}%` }} />
                  <div className="absolute -inset-y-1 w-px bg-foreground" style={{ left: `${((0.95 - 0.85) / 0.15) * 100}%` }} />
                </div>
              </div>
            ))}
          </dl>
          {!compact && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              EWMA was overconfident: its &ldquo;95%&rdquo; band let the price escape about twice as often as
              advertised. Use the band, not the midline.
            </p>
          )}
        </div>
      </div>

      {compact && (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          An analytics terminal that tells you when there is no edge.{' '}
          <Link href="/intelligence#evaluation" className="text-foreground underline-offset-2 hover:underline">
            Full report
          </Link>
        </div>
      )}
    </section>
  )
}

/** One-line status-bar version. */
export function EdgeBadge() {
  return (
    <Link
      href="/intelligence#evaluation"
      className="hidden items-center gap-2 rounded-md border border-border px-2 py-1 text-[11px] text-secondary-foreground transition-colors hover:border-border-strong hover:text-foreground xl:inline-flex"
      title="Measured offline: 50.2% directional hit-rate over 1,500 calls (no edge); GARCH band coverage 94.75% vs 95% target"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
      Edge <span className="font-semibold text-foreground">none</span>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      Bands <span className="font-semibold text-foreground">calibrated</span>
    </Link>
  )
}
