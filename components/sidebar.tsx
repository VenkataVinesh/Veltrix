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
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Trade',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'markets', label: 'Markets', icon: LineChart },
      { id: 'signals', label: 'Signals', icon: Brain },
      { id: 'forecast', label: 'Forecast', icon: Sparkles },
    ],
  },
  {
    label: 'Portfolio',
    items: [
      { id: 'portfolio', label: 'Positions', icon: Briefcase },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'optimizer', label: 'Optimizer', icon: SlidersHorizontal },
      { id: 'risk', label: 'Risk', icon: Shield },
    ],
  },
  {
    label: 'Intel',
    items: [
      { id: 'macro', label: 'Macro', icon: Globe2 },
      { id: 'flow', label: 'Flow', icon: Building2 },
      { id: 'copilot', label: 'Copilot', icon: MessageSquare },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarExpanded, setSidebarExpanded } = useAppStore()
  const active = pathname.split('/')[1] || 'dashboard'

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarExpanded ? 200 : 56 }}
      transition={{ type: 'tween', duration: 0.16, ease: 'easeOut' }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden border-r border-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-[48px] items-center gap-2.5 border-b border-border px-3.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-primary">
          <span className="font-mono text-[13px] font-bold leading-none text-primary-foreground">V</span>
        </div>
        <AnimatePresence>
          {sidebarExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="min-w-0 leading-none"
            >
              <span className="font-mono text-[12px] font-semibold tracking-[0.08em] text-foreground">VELTRIX</span>
              <span className="ml-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">TRM</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1.5">
            {sidebarExpanded ? (
              <div className="section-label px-2 pb-1 pt-2">{group.label}</div>
            ) : (
              <div className="mx-2 my-2 border-t border-border" />
            )}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const isActive = active === item.id
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <Link
                      href={`/${item.id}`}
                      className={cn('nav-item', isActive && 'active')}
                      title={!sidebarExpanded ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <AnimatePresence>
                        {sidebarExpanded && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.08 }}
                            className="truncate"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex w-full items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  )
}
