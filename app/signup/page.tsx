import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'
import { AuthLayout } from '@/components/auth-layout'

export const metadata = { title: 'Sign up — Veltrix' }

export default function SignupPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthLayout>
  )
}
