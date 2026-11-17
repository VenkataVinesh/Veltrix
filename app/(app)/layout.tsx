import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { DEMO_COOKIE } from '@/middleware'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const isDemo = !user && cookieStore.get(DEMO_COOKIE)?.value === '1'

  // Middleware already guards these routes; this is the server-side backstop.
  if (!user && !isDemo) redirect('/login')

  return (
    <AppShell email={user?.email ?? 'Demo visitor (read-only)'} isDemo={isDemo}>
      {children}
    </AppShell>
  )
}
