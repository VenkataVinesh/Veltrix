'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, CandlestickChart, Coins, Brain, Briefcase, Settings,
  LogOut, Menu, X, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Trade', icon: CandlestickChart },
  { href: '/markets', label: 'Markets', icon: Coins },
  { href: '/intelligence', label: 'Intelligence', icon: Brain },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn('nav-item', active && 'active')}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Veltrix</span>
        </Link>
        {nav}
        <div className="mt-auto">
          <div className="panel-inset px-4 py-3.5">
            <p className="eyebrow">Signed in</p>
            <p className="mt-1 truncate text-sm text-foreground">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="nav-item mt-2 w-full text-left hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </div>
          <span className="font-semibold tracking-tight">Veltrix</span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="btn-ghost p-2.5"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-x-0 top-[69px] z-40 border-b border-border bg-background px-5 py-5 lg:hidden">
          {nav}
          <button onClick={signOut} className="nav-item mt-2 w-full text-left hover:text-destructive">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      )}

      <main className="px-5 py-6 lg:pl-[calc(248px+2rem)] lg:pr-8 lg:py-8">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  )
}
