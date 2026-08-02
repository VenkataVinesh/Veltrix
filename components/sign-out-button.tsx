'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/')
        router.refresh()
      }}
      className="btn-ghost inline-flex items-center gap-2 px-5 py-2.5 text-sm hover:text-destructive"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  )
}
