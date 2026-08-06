'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { api } from '@/lib/api'
import type { MacroReading, MacroGroup } from '@/lib/market/macro'
import { Card, Eyebrow, EmptyState, Skeleton } from '@/components/ui/primitives'
import { MacroSpark } from '@/components/macro-spark'
import { Explain } from '@/components/ui/glossary'
import { cn } from '@/lib/utils'

const GROUPS: { id: MacroGroup; title: string; blurb: string }[] = [
  {
    id: 'rates',
    title: 'Rates & the curve',
    blurb:
      'What money costs. Rates set the discount applied to every future cash flow, so they move share prices even when nothing about the company has changed.',
  },
  {
    id: 'inflation',
    title: 'Inflation',
    blurb:
      'How fast prices are rising. This is what the Federal Reserve is actually reacting to when it moves the policy rate.',
  },
  {
    id: 'labour',
    title: 'Jobs',
    blurb:
      'The health of the labour market — the other half of the Fed\'s mandate, and the part that decides whether a slowdown becomes a recession.',
  },
  {
    id: 'risk',
    title: 'Risk appetite',
    blurb: 'What the options market is charging for protection. A direct read on how nervous people are.',
  },
]

/** Series where a rising number is bad news for risk assets. */
const HIGHER_IS_WORSE = new Set(['CPIAUCSL', 'CPILFESL', 'UNRATE', 'VIXCLS', 'DGS10', 'DGS2', 'FEDFUNDS'])

/** Payrolls are whole thousands of jobs; two decimals on them reads as noise. */
const decimalsFor = (id: string) => (id === 'PAYEMS' ? 0 : 2)
const signed = (v: number, id: string) => `${v > 0 ? '+' : ''}${v.toFixed(decimalsFor(id))}`

function ChangeBadge({ value, id }: { value: number | null; id: string }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">no prior reading</span>
  }
  const flat = Math.abs(value) < (id === 'PAYEMS' ? 0.5 : 0.005)
  const Icon = flat ? Minus : value > 0 ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs tnum',
        flat ? 'text-muted-foreground' : value > 0 ? 'text-success' : 'text-destructive'
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {flat ? 'unchanged' : `${signed(value, id)}${id === 'PAYEMS' ? 'k' : ''}`}
    </span>
  )
}

function ReadingCard({ r }: { r: MacroReading }) {
  // The sparkline is coloured by whether the recent move is *good*, not by
  // whether the line goes up. Rising unemployment is not a green line.
  const rising = (r.change ?? 0) > 0
  const good = HIGHER_IS_WORSE.has(r.id) ? !rising : rising

  return (
    <div className="card-surface flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5">
            <Eyebrow className="truncate">{r.label}</Eyebrow>
            <Explain title={r.label} body={r.note} />
          </span>
          <p className="figure figure-md mt-2 tnum">
            {r.value.toFixed(decimalsFor(r.id))}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{r.unit}</span>
          </p>
        </div>
        <MacroSpark values={r.spark} positive={good} showZero={r.id === 'T10Y2Y'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
        <ChangeBadge value={r.change} id={r.id} />
        <span className="text-xs text-muted-foreground">
          {r.changeYear !== null && (
            <>
              <span className="tnum">{signed(r.changeYear, r.id)}</span> vs a year ago ·{' '}
            </>
          )}
          as of {r.asOf}
        </span>
      </div>
    </div>
  )
}

/**
 * The one genuinely interpretive number on the page, so it gets its own
 * treatment — and an explicit caveat, because "inverted curve" gets quoted
 * as a recession guarantee far more confidently than the record supports.
 */
function CurveCallout({ curve }: { curve: MacroReading }) {
  const inverted = curve.value < 0
  return (
    <Card className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
      <div>
        <Eyebrow>Yield curve</Eyebrow>
        <p className="mt-2 text-lg font-medium">
          {inverted ? 'Inverted' : 'Normal'} —{' '}
          <span className="tnum">
            {curve.value > 0 ? '+' : ''}
            {curve.value.toFixed(2)}%
          </span>
        </p>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {inverted
            ? 'Short-term borrowing costs more than long-term, which is backwards. Every US recession since the 1970s was preceded by this, but the lag has run from six months to two years and there has been at least one false alarm. It is a caution flag, not a signal to act on.'
            : 'Long rates sit above short rates, which is the normal shape. Lending for longer pays more, as it should.'}
        </p>
      </div>
      <div
        className={cn(
          'chip shrink-0 self-start sm:self-center',
          inverted ? 'chip-down' : 'chip-up'
        )}
      >
        {inverted ? 'Caution' : 'Normal'}
      </div>
    </Card>
  )
}

export function MacroView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['macro'],
    queryFn: () => api.macro(),
    // Most of this is monthly data; refetching hard would just burn quota.
    staleTime: 30 * 60_000,
  })

  const series = data?.series ?? []
  const curve = series.find((s) => s.id === 'T10Y2Y')

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Federal Reserve Economic Data</Eyebrow>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.02em]">Macro</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The backdrop every position sits in. These are published series from FRED, shown as
          released — no forecasts, no adjustments. Each one explains what it measures and why it
          matters; tap the question mark.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 px-5 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">
            Could not reach the macro endpoint. {String(error instanceof Error ? error.message : error)}
          </p>
        </div>
      )}

      {data?.unavailable && (
        <div className="flex items-start gap-3 rounded-2xl bg-primary/10 px-5 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">
            <span className="font-medium">Macro data unavailable.</span>{' '}
            <span className="text-muted-foreground">
              {data.reason} FRED keys are free and instant from the St. Louis Fed.
            </span>
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px]" />
          ))}
        </div>
      )}

      {curve && <CurveCallout curve={curve} />}

      {GROUPS.map((g) => {
        const rows = series.filter((s) => s.group === g.id)
        if (!rows.length) return null
        return (
          <section key={g.id} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{g.blurb}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <ReadingCard key={r.id} r={r} />
              ))}
            </div>
          </section>
        )
      })}

      {!isLoading && !series.length && !data?.unavailable && !error && (
        <EmptyState title="No macro series returned" body="FRED responded but carried no usable observations." />
      )}

      {!!series.length && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Source: Federal Reserve Bank of St. Louis (FRED). Series are cached for an hour; most
          update monthly. Nothing here is a forecast — the numbers are exactly as published.
        </p>
      )}
    </div>
  )
}
