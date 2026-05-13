'use client'

import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { useAppStore } from '@/lib/store'

export function TerminalShell({ children }: { children: React.ReactNode }) {
  const { sidebarExpanded } = useAppStore()
  const leftOffset = sidebarExpanded ? 220 : 64

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-x-hidden selection:bg-cyan-500/30">
      {/* Cinematic Background Elements */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#020204]" />
      <div className="pointer-events-none fixed top-[-20%] left-[20%] w-[80%] h-[60%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_60%)] blur-[100px] z-0" />
      <div className="pointer-events-none fixed bottom-[-10%] right-[-10%] w-[60%] h-[70%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1),transparent_60%)] blur-[120px] z-0" />
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />

      <Sidebar />
      <Topbar />
      <main
        className="relative z-10 pt-[52px] transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ paddingLeft: leftOffset }}
      >
        <div className="p-4 lg:p-6 pb-24">
          {children}
        </div>
      </main>
    </div>
  )
}

