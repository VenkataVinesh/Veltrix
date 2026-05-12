'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const SECTION_KEYS: Record<string, string> = {
  '1': 'dashboard',
  '2': 'markets',
  '3': 'signals',
  '4': 'forecast',
  '5': 'analytics',
  '6': 'portfolio',
  '7': 'optimizer',
  '8': 'risk',
  '9': 'macro',
  '0': 'flow',
}

type ShortcutCallbacks = {
  onCommandPalette: () => void
  onCopilot: () => void
}

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      // ⌘K — command palette
      if (meta && e.key === 'k') {
        e.preventDefault()
        callbacks.onCommandPalette()
        return
      }

      // ⌘I — AI copilot
      if (meta && e.key === 'i') {
        e.preventDefault()
        callbacks.onCopilot()
        return
      }

      // Don't capture if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Number keys for section navigation
      if (e.key >= '0' && e.key <= '9' && !meta) {
        const section = SECTION_KEYS[e.key]
        if (section && section !== pathname.split('/')[1]) {
          router.push(`/${section}`)
        }
      }

      // G then S — go to stocks (GS)
      // G then D — go to dashboard (GD)
      // This is a simplified implementation
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, pathname, callbacks])
}
