'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api'
import { NAV } from '@/components/nav'
import { CommandPalette } from '@/components/command-palette'
import { ShortcutsSheet } from '@/components/shortcuts-sheet'
import { EdgeBadge } from '@/components/edge-report'
import { fmtPrice } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">V</span>
      {withName && <span className="text-sm font-semibold tracking-tight">Veltrix</span>}
    </span>
  )
}

/** Live quotes strip. Shares the ['quotes'] cache with the dashboard. */
function Ticker() {
  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ['quotes'], queryFn: () => api.quotes(), refetchInterval: 30_000,
  })
  const prev = useRef(new Map<string, number>())
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({})

  useEffect(() => {
    if (!data) return
    const next: Record<string, 'up' | 'down'> = {}
    for (const q of data.quotes) {
      const p = prev.current.get(q.symbol)
      if (p !== undefined && p !== q.price) next[q.symbol] = q.price > p ? 'up' : 'down'
      prev.current.set(q.symbol, q.price)
    }
    setFlash(next)
    const t = setTimeout(() => setFlash({}), 700)
    return () => clearTimeout(t)
  }, [data])

  const quotes = data?.quotes ?? []
  const time = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour12: false }) : null

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Live quotes">
        {!data && !isError && Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-4 w-24 shrink-0" />)}
        {isError && <span className="text-xs text-destructive">Quotes unavailable</span>}
        {quotes.map((q) => (
          <Link
            key={q.symbol}
            href={`/trade?symbol=${q.symbol}`}
            className={cn('flex shrink-0 items-baseline gap-1.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-elevated', flash[q.symbol] && `flash-${flash[q.symbol]}`)}
          >
            <span className="font-semibold text-foreground">{q.symbol}</span>
            <span className="tnum text-secondary-foreground">{fmtPrice(q.price)}</span>
            <span className={cn('tnum', q.change >= 0 ? 'text-success' : 'text-destructive')}>
              {q.change >= 0 ? '▲' : '▼'}{Math.abs(q.change).toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
      {time && (
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground md:inline-flex" title="Last successful quote refresh (every 30s)">
          <span className="status-dot live" aria-hidden="true" />
          <span className="tnum">{time}</span>
          <span className="hidden 2xl:inline">· {data?.quotes[0]?.source ?? 'feed'}</span>
        </span>
      )}
    </div>
  )
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const gPending = useRef<number | null>(null)

  const signOut = useCallback(async () => {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }, [router])
  const closePalette = useCallback(() => setPalette(false), [])
  const showHelp = useCallback(() => setHelp(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setHelp(false); setPalette((p) => !p); return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || palette || help) return
      if (e.key === '/') { e.preventDefault(); setPalette(true); return }
      if (e.key === '?') { e.preventDefault(); setHelp(true); return }
      if (gPending.current !== null) {
        const item = NAV.find((n) => n.key === e.key.toLowerCase())
        window.clearTimeout(gPending.current); gPending.current = null
        if (item) { e.preventDefault(); router.push(item.href) }
        return
      }
      if (e.key === 'g') gPending.current = window.setTimeout(() => { gPending.current = null }, 1200)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, palette, help])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only z-[90] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Rail: icons at lg, icons + labels at xl */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col border-r border-border bg-background px-2 py-3 lg:flex xl:w-[200px] xl:px-3">
        <Link href="/dashboard" className="mb-5 flex h-8 items-center px-1.5" aria-label="Veltrix home">
          <span className="xl:hidden"><Logo withName={false} /></span>
          <span className="hidden xl:inline"><Logo /></span>
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={`${item.label}  (g ${item.key})`}
                className={cn('nav-item group justify-center xl:justify-start', active && 'active')}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="sr-only xl:not-sr-only">{item.label}</span>
                <span className="ml-auto hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 xl:flex" aria-hidden="true">
                  <kbd>g</kbd><kbd>{item.key}</kbd>
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto space-y-1">
          <p className="hidden truncate px-2.5 text-[11px] text-muted-foreground xl:block" title={email}>{email}</p>
          <button onClick={signOut} className="nav-item w-full justify-center hover:text-destructive xl:justify-start" title="Sign out">
            <LogOut className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only xl:not-sr-only">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Status bar */}
      <header className="sticky top-0 z-30 flex h-11 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur lg:pl-[calc(3.5rem+0.75rem)] xl:pl-[calc(200px+1rem)]">
        <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="Veltrix home"><Logo withName={false} /></Link>
        <Ticker />
        <EdgeBadge />
        <button
          onClick={() => setPalette(true)}
          className="btn-outline h-7 shrink-0 gap-2 px-2 text-xs text-muted-foreground sm:w-56 sm:justify-start"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <span className="ml-auto hidden gap-0.5 sm:flex" aria-hidden="true"><kbd>⌘</kbd><kbd>K</kbd></span>
        </button>
      </header>

      <main id="main" className="px-3 pb-24 pt-3 sm:px-4 lg:pb-8 lg:pl-[calc(3.5rem+1rem)] lg:pr-5 lg:pt-4 xl:pl-[calc(200px+1.25rem)]">
        <div key={pathname} className="page-enter mx-auto max-w-[1600px]">
          {children}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {NAV.filter((n) => n.mobile).map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}
            >
              <item.icon className={cn('h-[18px] w-[18px]', active && 'text-primary')} strokeWidth={1.9} aria-hidden="true" />
              {item.short}
            </Link>
          )
        })}
      </nav>

      <CommandPalette open={palette} onClose={closePalette} onSignOut={signOut} onShowShortcuts={showHelp} />
      <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
    </div>
  )
}
