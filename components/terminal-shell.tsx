'use client'

import { AnimatedBackground } from '@/components/animated-background'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { MarketStatusBar } from '@/components/market-status-bar'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

export function TerminalShell({ children }: { children: React.ReactNode }) {
  const { sidebarExpanded } = useAppStore()

  return (
    <div className="min-h-screen">
      <AnimatedBackground />
      <Sidebar />
      <Topbar />
      <MarketStatusBar />
      <main
        className={cn(
          'pt-24 pb-8 pr-4 md:pr-8 transition-all duration-300',
          sidebarExpanded ? 'pl-[calc(16rem+1.5rem)] md:pl-[calc(16rem+2rem)]' : 'pl-[calc(5rem+1.5rem)] md:pl-[calc(5rem+2rem)]'
        )}
      >
        {children}
      </main>
    </div>
  )
}
