'use client'

import { RotateCw, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoTip, type GlossaryTerm } from '@/components/ui/glossary'

/* Soft-rounded surface — the workhorse container. */
export function Card({
  children, className, as: Tag = 'div',
}: { children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cn('card-surface p-4', className)}>{children}</Tag>
}

/* Small uppercase label above a value. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>
}

/* Panel with a header row — the terminal's standard container. */
export function Panel({
  title, term, actions, children, className, bodyClassName, id,
}: {
  title: React.ReactNode
  term?: GlossaryTerm
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('card-surface flex min-w-0 flex-col', className)}>
      <header className="panel-head">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <h2 className="eyebrow truncate">{title}</h2>
          {term && <InfoTip term={term} />}
        </span>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('flex min-w-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  )
}

/* Signed change. Colour is never the only cue: sign and arrow carry it too. */
export function Delta({ value, suffix = '%', className }: { value: number; suffix?: string; className?: string }) {
  const up = value >= 0
  return (
    <span className={cn('inline-flex items-center gap-1 tnum font-medium', up ? 'text-success' : 'text-destructive', className)}>
      <span aria-hidden="true" className="text-[0.7em]">{up ? '▲' : '▼'}</span>
      {up ? '+' : '−'}{Math.abs(value).toFixed(2)}{suffix}
    </span>
  )
}

/* Signed percentage chip. */
export function DeltaChip({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0
  return (
    <span className={cn('chip tnum', up ? 'chip-up' : 'chip-down')}>
      {up ? '▲' : '▼'} {up ? '+' : '−'}{Math.abs(value).toFixed(2)}{suffix}
    </span>
  )
}

/* Headline metric block. */
export function Stat({
  label, value, delta, sub, className, term,
}: {
  label: string
  value: string
  delta?: number
  sub?: string
  className?: string
  /** Glossary key. Every headline number should be able to explain itself. */
  term?: GlossaryTerm
}) {
  return (
    <Card className={cn('p-3.5', className)}>
      {term ? (
        <span className="inline-flex items-center gap-1.5">
          <Eyebrow>{label}</Eyebrow>
          <InfoTip term={term} />
        </span>
      ) : (
        <Eyebrow>{label}</Eyebrow>
      )}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <span className="figure figure-lg">{value}</span>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>
      {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />
}

/* Error with a way out. Says what failed, never invents a fallback. */
export function ErrorState({
  title = 'Could not load this', body, onRetry,
}: { title?: string; body?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body && <p className="max-w-md text-xs text-muted-foreground">{body}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-outline mt-2 px-3 py-1.5 text-xs">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  )
}

/* Consistent empty / error state so no screen ever renders blank. */
export function EmptyState({
  title, body, action, icon: Icon,
}: { title: string; body: string; action?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {Icon && <Icon className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export const fmtUsd = (n: number, dp = 2) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

export const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : n.toFixed(2)

/** Crypto needs more precision than equities at small prices. */
export const fmtPrice = (n: number) =>
  n >= 1000 ? fmtUsd(n, 2) : n >= 1 ? fmtUsd(n, 2) : fmtUsd(n, 6)
