import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'
import { AuthLayout } from '@/components/auth-layout'

export const metadata = { title: 'Log in — Veltrix' }

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthLayout>
  )
}
