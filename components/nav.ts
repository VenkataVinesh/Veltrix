import {
  LayoutDashboard, CandlestickChart, Coins, Brain, Landmark, Briefcase, Settings, type LucideIcon,
} from 'lucide-react'

/** Single source for navigation: sidebar, mobile tabs, palette and `g` shortcuts. */
export const NAV: { href: string; label: string; short: string; icon: LucideIcon; key: string; mobile?: boolean }[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, key: 'd', mobile: true },
  { href: '/trade', label: 'Trade', short: 'Trade', icon: CandlestickChart, key: 't', mobile: true },
  { href: '/markets', label: 'Markets', short: 'Markets', icon: Coins, key: 'm', mobile: true },
  { href: '/intelligence', label: 'Intelligence', short: 'Intel', icon: Brain, key: 'i', mobile: true },
  { href: '/macro', label: 'Macro', short: 'Macro', icon: Landmark, key: 'c' },
  { href: '/portfolio', label: 'Portfolio', short: 'Portfolio', icon: Briefcase, key: 'p', mobile: true },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: Settings, key: 's' },
]
