'use client'

import { cn } from '@/lib/utils'
import { InfoTip, type GlossaryTerm } from '@/components/ui/glossary'

/* Soft-rounded surface — the workhorse container. */
export function Card({
  children, className, as: Tag = 'div',
}: { children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cn('card-surface p-6', className)}>{children}</Tag>
}

/* Small uppercase label above a value. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>
}

/* Signed percentage chip. */
export function DeltaChip({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0
  return (
    <span className={cn('chip tnum', up ? 'chip-up' : 'chip-down')}>
      {up ? '+' : ''}{value.toFixed(2)}{suffix}
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
    <Card className={className}>
      {term ? (
        <span className="inline-flex items-center gap-1.5">
          <Eyebrow>{label}</Eyebrow>
          <InfoTip term={term} />
        </span>
      ) : (
        <Eyebrow>{label}</Eyebrow>
      )}
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <span className="figure figure-lg">{value}</span>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </Card>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-elevated', className)} />
}

/* Consistent empty / error state so no screen ever renders blank. */
export function EmptyState({
  title, body, action,
}: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
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
