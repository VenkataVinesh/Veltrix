import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { DEMO_COOKIE } from '@/middleware'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith('sb-'))
  const demoCookie = cookieStore.get(DEMO_COOKIE)?.value === '1'

  let user: { email?: string } | null = null
  if (!demoCookie || hasAuthCookie) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  const isDemo = !user && demoCookie

  // Middleware already guards these routes; this is the server-side backstop.
  if (!user && !isDemo) redirect('/login')

  return (
    <AppShell email={user?.email ?? 'Demo visitor (read-only)'} isDemo={isDemo}>
      {children}
    </AppShell>
  )
}
