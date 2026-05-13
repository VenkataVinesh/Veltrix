'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, LineChart, Brain, Sparkles, BarChart3,
  Briefcase, SlidersHorizontal, Shield, Globe2, Building2,
  MessageSquare, Bell, Settings, ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'markets',   label: 'Markets',   icon: LineChart },
  { id: 'signals',   label: 'AI Signals', icon: Brain },
  { id: 'forecast',  label: 'Forecast',  icon: Sparkles },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'optimizer', label: 'Optimizer', icon: SlidersHorizontal },
  { id: 'risk',      label: 'Risk Engine', icon: Shield },
  { id: 'macro',     label: 'Macro Intel', icon: Globe2 },
  { id: 'flow',      label: 'Inst. Flow', icon: Building2 },
  { id: 'copilot',   label: 'AI Copilot', icon: MessageSquare },
  { id: 'alerts',    label: 'Alerts',    icon: Bell },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarExpanded, setSidebarExpanded } = useAppStore()
  const active = pathname.split('/')[1] || 'dashboard'

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarExpanded ? 220 : 64 }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(5,5,7,0.96), rgba(9,9,11,0.94))',
        borderRight: '1px solid rgba(220,232,255,0.075)',
        boxShadow: '24px 0 80px rgba(0,0,0,0.22)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.055]">
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[linear-gradient(135deg,#f5f7fb,#8fd8ff_55%,#a78bfa)] shadow-[0_0_32px_rgba(143,216,255,0.18)]">
          <span className="text-sm font-black text-[#050507]">V</span>
        </div>
        <AnimatePresence>
          {sidebarExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-w-0"
            >
              <div className="text-[13px] font-semibold tracking-tight text-white leading-none">VELTRIX</div>
              <div className="text-[9px] text-cyan-100/45 tracking-[0.32em] font-medium mt-0.5">TERMINAL</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const isActive = active === item.id
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={`/${item.id}`}
                  className={cn('nav-item', isActive && 'active')}
                  title={!sidebarExpanded ? item.label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <AnimatePresence>
                    {sidebarExpanded && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 rounded-lg bg-[linear-gradient(90deg,rgba(143,216,255,0.10),rgba(167,139,250,0.045))]"
                      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-white/[0.055]">
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-[#7f8794] hover:text-white hover:bg-white/[0.045] transition-all"
        >
          {sidebarExpanded ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.aside>
  )
}
