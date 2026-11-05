'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * The selected symbol lives in the URL (?symbol=ETH) so the command palette,
 * the ticker and shared links can all deep-link into a view.
 */
export function useSymbolParam(fallback: string, allowed?: readonly string[]) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('symbol')?.toUpperCase()
  const symbol = raw && (!allowed || allowed.includes(raw)) ? raw : fallback
  const setSymbol = useCallback(
    (s: string) => router.replace(`${pathname}?symbol=${encodeURIComponent(s)}`, { scroll: false }),
    [router, pathname]
  )
  return [symbol, setSymbol] as const
}
