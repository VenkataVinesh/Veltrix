'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (isSignup && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setPending(true)
    const supabase = createClient()

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })
        if (error) throw error

        // With email confirmation on, there's no session yet.
        if (!data.session) {
          setNotice('Check your inbox to confirm your email, then log in.')
          setPending(false)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }

      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setPending(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="mb-10 inline-flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
          <span className="text-sm font-bold text-primary-foreground">V</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">Veltrix</span>
      </Link>

      <h1 className="text-3xl font-semibold tracking-[-0.02em]">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-2.5 text-[15px] text-muted-foreground">
        {isSignup
          ? 'Free account. Your portfolio starts with $100,000 in paper cash.'
          : 'Log in to your terminal.'}
      </p>

      <form onSubmit={onSubmit} className="mt-9 space-y-4">
        <div>
          <label htmlFor="email" className="eyebrow">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-border bg-elevated px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="password" className="eyebrow">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
            className="mt-2 w-full rounded-xl border border-border bg-elevated px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-lime flex w-full items-center justify-center gap-2 py-3.5 text-[15px] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSignup ? 'Create account' : 'Log in'}
          {!pending && <ArrowUpRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-7 text-sm text-muted-foreground">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-medium text-primary hover:underline"
        >
          {isSignup ? 'Log in' : 'Sign up free'}
        </Link>
      </p>
    </div>
  )
}
