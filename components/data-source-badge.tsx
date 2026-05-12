import type { DataMeta } from '@/shared/contracts/index'
import { cn } from '@/lib/utils'

type Props = DataMeta & { className?: string }

function isSimulated(provider: string) {
  return provider.includes('fallback') || provider.includes('simulated') || provider.includes('local-dev')
}

function isRealtime(realtime?: boolean) {
  return realtime === true
}

export function DataSourceBadge({ provider, stale, realtime, className }: Props) {
  if (isSimulated(provider)) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        SIMULATED
      </span>
    )
  }

  if (stale) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        STALE
      </span>
    )
  }

  if (isRealtime(realtime)) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/30', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        LIVE
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-muted-foreground border border-border/60', className)}>
      {provider}
    </span>
  )
}
