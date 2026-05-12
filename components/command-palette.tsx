'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, LineChart, Brain, Sparkles, BarChart3, Briefcase, SlidersHorizontal, Shield, Globe2, Building2, MessageSquare, Bell, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'signals', label: 'AI Signals', icon: Brain },
  { id: 'forecast', label: 'Forecast Engine', icon: Sparkles },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'optimizer', label: 'Optimizer', icon: SlidersHorizontal },
  { id: 'risk', label: 'Risk Engine', icon: Shield },
  { id: 'macro', label: 'Macro Intel', icon: Globe2 },
  { id: 'flow', label: 'Institutional Flow', icon: Building2 },
  { id: 'copilot', label: 'AI Copilot', icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { data: quotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: api.quotes,
    enabled: open,
  })

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) || item.id.includes(query.toLowerCase())
  )

  const filteredSymbols = (quotes ?? [])
    .filter((q) => q.symbol.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)

  const allResults = [
    ...filteredNav.map((item) => ({ type: 'nav' as const, id: item.id, label: item.label, icon: item.icon })),
    ...filteredSymbols.map((q) => ({ type: 'symbol' as const, id: q.symbol, label: `${q.symbol} — $${q.price.toFixed(2)}`, icon: null })),
  ]

  const execute = useCallback((result: typeof allResults[0]) => {
    onClose()
    setQuery('')
    if (result.type === 'nav') router.push(`/${result.id}`)
    else router.push(`/stocks/${result.id}`)
  }, [router, onClose])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && allResults[selectedIndex]) execute(allResults[selectedIndex])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selectedIndex, allResults, execute, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search views, symbols..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {allResults.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">No results for &quot;{query}&quot;</div>
          )}
          {allResults.map((result, i) => {
            const Icon = result.type === 'nav' ? result.icon : null
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => execute(result)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                  i === selectedIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary/50'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {!Icon && <span className="w-4 h-4 shrink-0 font-mono text-xs text-muted-foreground">$</span>}
                <span>{result.label}</span>
                {result.type === 'symbol' && (
                  <span className="ml-auto text-xs text-muted-foreground">View stock</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
