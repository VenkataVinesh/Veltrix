'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CandlestickChart, Command, CornerDownLeft, Keyboard, LineChart, LogOut, Scale, Search, type LucideIcon } from 'lucide-react'
import { CRYPTO_IDS, EQUITY_NAMES } from '@/lib/market/providers'
import { NAV } from '@/components/nav'
import { cn } from '@/lib/utils'

export interface PaletteItem {
  id: string
  label: string
  hint?: string
  group: 'Go to' | 'Symbols' | 'Actions'
  icon: LucideIcon
  keys?: string[]
  keywords?: string
  run: () => void
}

/** Subsequence match with a bonus for word starts — enough for ~100 items. */
function score(q: string, label: string, keywords = ''): number {
  const t = label.toLowerCase()
  if (t.startsWith(q)) return 100 - t.length
  const idx = t.indexOf(q)
  if (idx >= 0) return 60 - idx
  // Keywords (asset names etc.) only match as whole substrings.
  const k = keywords.toLowerCase().indexOf(q)
  if (k >= 0) return 40 - Math.min(k, 30)
  // Fuzzy subsequence on the label only, so "eth" never pulls in "Dogecoin".
  let i = 0
  for (const ch of t) if (ch === q[i]) i++
  return i === q.length ? 10 : 0
}

export function CommandPalette({
  open, onClose, onSignOut, onShowShortcuts,
}: {
  open: boolean
  onClose: () => void
  onSignOut: () => void
  onShowShortcuts: () => void
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => { router.push(href); onClose() }
    const nav: PaletteItem[] = NAV.map((n) => ({
      id: `nav-${n.href}`, label: n.label, group: 'Go to', icon: n.icon,
      keys: ['g', n.key], run: go(n.href),
    }))
    const symbols: PaletteItem[] = [
      ...Object.entries(CRYPTO_IDS).map(([s, m]) => [s, m.name, 'crypto'] as const),
      ...Object.entries(EQUITY_NAMES).map(([s, n]) => [s, n, 'equity'] as const),
    ].flatMap(([s, name, kind]) => [
      { id: `trade-${s}`, label: `${s}`, hint: `${name} · chart & paper trade`, group: 'Symbols' as const, icon: CandlestickChart, keywords: `${name} ${kind} trade chart`, run: go(`/trade?symbol=${s}`) },
      { id: `fc-${s}`, label: `${s} forecast`, hint: `${name} · bands, signal, debate`, group: 'Symbols' as const, icon: LineChart, keywords: `${name} ${kind} forecast intelligence`, run: go(`/intelligence?symbol=${s}`) },
    ])
    const actions: PaletteItem[] = [
      { id: 'edge', label: 'Edge report', hint: 'what was measured, and what has no edge', group: 'Actions', icon: Scale, keywords: 'evaluation hit rate garch calibration honesty', run: go('/intelligence#evaluation') },
      { id: 'keys', label: 'Keyboard shortcuts', group: 'Actions', icon: Keyboard, keys: ['?'], run: () => { onClose(); onShowShortcuts() } },
      { id: 'signout', label: 'Sign out', group: 'Actions', icon: LogOut, run: () => { onClose(); onSignOut() } },
    ]
    return [...nav, ...actions, ...symbols]
  }, [router, onClose, onSignOut, onShowShortcuts])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) {
      const featured = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA']
      return items.filter((i) => i.group !== 'Symbols' || (featured.includes(i.label) && !i.label.includes('forecast')))
    }
    const ranked = items
      .map((i) => ({ i, s: score(query, i.label, i.keywords) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
    // Keep each group together (one header per group), groups ordered by their best match.
    const order: string[] = []
    for (const r of ranked) if (!order.includes(r.i.group)) order.push(r.i.group)
    return order.flatMap((g) => ranked.filter((r) => r.i.group === g).map((r) => r.i))
  }, [q, items])

  useEffect(() => { setActive(0) }, [q])

  useEffect(() => {
    if (open) {
      restoreFocus.current = document.activeElement as HTMLElement | null
      setQ('')
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      restoreFocus.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); results[active]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'Tab') { e.preventDefault() } // focus stays in the dialog
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        className="palette-in w-full max-w-[560px] overflow-hidden rounded-xl border border-border-strong bg-overlay shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, symbols, actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
            aria-autocomplete="list"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd>esc</kbd>
        </div>

        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">No match for “{q}”.</li>
          )}
          {results.map((r, idx) => {
            const header = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <li key={r.id} role="presentation">
                {header && <p className="eyebrow px-2.5 pb-1 pt-2.5">{header}</p>}
                <div
                  id={`pal-${r.id}`}
                  role="option"
                  aria-selected={idx === active}
                  data-index={idx}
                  onMouseMove={() => setActive(idx)}
                  onClick={() => r.run()}
                  className={cn(
                    'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm',
                    idx === active ? 'bg-elevated text-foreground' : 'text-secondary-foreground'
                  )}
                >
                  <r.icon className={cn('h-4 w-4 shrink-0', idx === active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className="font-medium">{r.label}</span>
                  {r.hint && <span className="truncate text-xs text-muted-foreground">{r.hint}</span>}
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {r.keys?.map((k) => <kbd key={k}>{k}</kbd>)}
                    {idx === active && !r.keys && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span className="inline-flex items-center gap-1"><kbd><CornerDownLeft className="h-3 w-3" /></kbd> open</span>
          <span className="ml-auto inline-flex items-center gap-1"><Command className="h-3 w-3" aria-hidden="true" />K anywhere</span>
        </div>
      </div>
    </div>
  )
}
