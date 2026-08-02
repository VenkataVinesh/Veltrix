'use client'

import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { useAppStore } from '@/lib/store'

export function TerminalShell({ children }: { children: React.ReactNode }) {
  const { sidebarExpanded } = useAppStore()
  const leftOffset = sidebarExpanded ? 200 : 56

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/25">
      <Sidebar />
      <Topbar />
      <main
        className="relative pt-[48px] transition-[padding-left] duration-150 ease-out"
        style={{ paddingLeft: leftOffset }}
      >
        <div className="p-3 pb-16 lg:p-4">
          {children}
        </div>
      </main>
    </div>
  )
}
