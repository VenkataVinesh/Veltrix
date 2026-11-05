'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { NAV } from '@/components/nav'

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  { title: 'Anywhere', rows: [[['⌘', 'K'], 'Command palette (Ctrl K on Windows/Linux)'], [['/'], 'Command palette'], [['?'], 'This sheet'], [['esc'], 'Close dialog']] },
  { title: 'Go to', rows: NAV.map((n) => [['g', n.key], n.label] as [string[], string]) },
  { title: 'In the palette', rows: [[['↑', '↓'], 'Move'], [['↵'], 'Open'], [['type'], 'Filter pages, 79 symbols, actions']] },
]

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) closeRef.current?.focus() }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); if (e.key === 'Escape') onClose() } }}
        className="palette-in w-full max-w-[520px] rounded-xl border border-border-strong bg-overlay p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between">
          <h2 id="kbd-title" className="text-sm font-semibold">Keyboard shortcuts</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="btn-ghost h-7 w-7"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title} className={g.title === 'Go to' ? 'sm:row-span-2' : ''}>
              <p className="eyebrow mb-2">{g.title}</p>
              <dl className="space-y-1.5">
                {g.rows.map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-xs">
                    <dt className="text-secondary-foreground">{label}</dt>
                    <dd className="flex shrink-0 gap-1">{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">Single-key shortcuts are ignored while you are typing in a field.</p>
      </div>
    </div>
  )
}
