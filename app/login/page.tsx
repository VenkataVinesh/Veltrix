import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'

export const metadata = { title: 'Log in — Veltrix' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  )
}
