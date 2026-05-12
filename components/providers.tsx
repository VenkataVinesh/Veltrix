'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { env } from '@/lib/env'
import { RealtimeProvider } from '@/components/realtime-provider'
import { CommandPalette } from '@/components/command-palette'
import OnboardingFlow from '@/components/onboarding-flow'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 10_000 },
        },
      })
  )

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useKeyboardShortcuts({
    onCommandPalette: useCallback(() => setPaletteOpen((o) => !o), []),
    onCopilot: useCallback(() => { window.location.href = '/copilot' }, []),
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    if (!isLocalHost && process.env.NODE_ENV === 'production') return

    const hasToken = window.localStorage.getItem('veltrix_access_token')
    if (hasToken) return

    api.login({ email: env.devAuthEmail, password: env.devAuthPassword }).catch(() => {})
  }, [])

  // Show onboarding on first visit
  useEffect(() => {
    const seen = localStorage.getItem('veltrix_onboarding_seen')
    if (!seen && window.location.pathname === '/dashboard') {
      setShowOnboarding(true)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        {showOnboarding && (
          <OnboardingFlow
            onComplete={() => {
              localStorage.setItem('veltrix_onboarding_seen', 'true')
              setShowOnboarding(false)
            }}
          />
        )}
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
