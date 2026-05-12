'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  LineChart, 
  Brain, 
  Sparkles, 
  BarChart3, 
  Briefcase, 
  SlidersHorizontal,
  Shield, 
  Globe2, 
  Building2, 
  MessageSquare, 
  Bell, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const navItems = [
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

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarExpanded, setSidebarExpanded } = useAppStore()
  const activeSection = pathname.split('/')[1] || 'dashboard'

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className={cn(
        "fixed left-4 top-4 bottom-4 z-50 flex flex-col glass rounded-2xl transition-all duration-300",
        sidebarExpanded ? "w-64" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 border-b border-border/50">
        <motion.div 
          className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center glow-amber"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg font-bold text-black">V</span>
          <div className="absolute inset-0 rounded-xl bg-amber-500/20 animate-neural-pulse" />
        </motion.div>
        {sidebarExpanded && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <h1 className="text-lg font-bold tracking-tight text-glow-amber">VELTRIX</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest">TERMINAL</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <motion.div
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                > 
                  <Link href={`/${item.id}`} className="absolute inset-0 rounded-xl" aria-label={item.label} />
                  <div className={cn(
                    "relative p-2 rounded-lg transition-all duration-200",
                    isActive ? "bg-primary/20" : "bg-transparent group-hover:bg-secondary"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5 transition-all duration-200",
                      isActive && "text-glow-amber"
                    )} />
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 rounded-lg bg-primary/10"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </div>
                  {sidebarExpanded && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeLine"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.div>
              </motion.li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-border/50">
        <motion.button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {sidebarExpanded ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </motion.button>
      </div>
    </motion.aside>
  )
}
