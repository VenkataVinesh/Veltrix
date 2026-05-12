'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: () => router.push('/dashboard'),
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl glass p-6 space-y-4">
        <h1 className="text-2xl font-bold">Sign in to VELTRIX</h1>
        <input className="w-full rounded-xl bg-secondary/40 p-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full rounded-xl bg-secondary/40 p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button
          disabled={loginMutation.isPending}
          onClick={() => loginMutation.mutate({ email, password })}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 disabled:opacity-60"
        >
          {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
        {loginMutation.error && <p className="text-sm text-destructive">Invalid credentials or service unavailable.</p>}
      </div>
    </div>
  )
}
