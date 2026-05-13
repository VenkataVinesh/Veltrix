'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Sparkles, Shield, CheckCircle2, XCircle, Mail, Lock, Zap } from 'lucide-react'
import { api } from '@/lib/api-client'

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,130,246,0.12),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_20%_80%,rgba(245,158,11,0.08),transparent)]" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.6) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 9, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/3 left-1/4 w-72 h-72 rounded-full bg-amber-500/5 blur-3xl"
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 11, repeat: Infinity }}
      />
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Contains uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Contains number', pass: /\d/.test(password) },
    { label: 'Contains special char', pass: /[!@#$%^&*]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length
  const colors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-success', 'bg-success']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score] : 'bg-border'}`}
          />
        ))}
        <span className={`text-xs ml-2 ${score >= 3 ? 'text-success' : score >= 2 ? 'text-yellow-500' : 'text-destructive'}`}>
          {labels[score]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-1.5 text-xs">
            {check.pass
              ? <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
              : <XCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            }
            <span className={check.pass ? 'text-success' : 'text-muted-foreground/60'}>{check.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

const BENEFITS = [
  'Realtime AI trading signals across 50+ instruments',
  'Institutional portfolio analytics & risk engine',
  'Multi-agent forecast ensemble models',
  'Live websocket market data feeds',
  'Smart money institutional flow detection',
]

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  const signupMutation = useMutation({
    mutationFn: api.signup,
    onSuccess: () => router.push('/dashboard'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || password.length < 8) return
    signupMutation.mutate({ email, password, role: 'trader' })
  }

  return (
    <div className="min-h-screen bg-[oklch(0.06_0.01_250)] flex overflow-hidden">
      <GridBackground />

      {/* Left side — form */}
      <div className="flex-1 flex items-center justify-center pt-8 pb-12 px-6 lg:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-all">
              <span className="text-base font-black text-black">V</span>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">VELTRIX</span>
              <span className="text-[9px] text-amber-500/70 tracking-[0.4em] ml-2">TERMINAL</span>
            </div>
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Create account</h2>
            <p className="mt-2 text-muted-foreground">Join the institutional AI trading platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                emailFocused ? 'border-blue-500/60 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]' : 'border-border/60'
              }`}>
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="you@institution.com"
                  className="w-full bg-secondary/30 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                passwordFocused ? 'border-blue-500/60 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]' : 'border-border/60'
              }`}>
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Min 8 characters"
                  className="w-full bg-secondary/30 rounded-xl pl-10 pr-11 py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Error */}
            <AnimatePresence>
              {signupMutation.isError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  Unable to create account. Email may already be in use.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={signupMutation.isPending || !email || password.length < 8}
              className="relative w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden group"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              {signupMutation.isPending ? (
                <>
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Creating account...
                </>
              ) : (
                <>
                  Launch Terminal Access
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>

            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{' '}
              <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</button>
              {' '}and{' '}
              <button type="button" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</button>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side — benefits */}
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex flex-col justify-center w-5/12 pr-16 pl-12 relative z-10"
      >
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">What you get</span>
            </div>
            <h3 className="text-3xl font-bold leading-tight">
              Everything you need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-300">
                trade intelligently
              </span>
            </h3>
          </div>

          <div className="space-y-3">
            {BENEFITS.map((benefit, i) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                </div>
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="p-5 rounded-2xl border border-border/40 bg-secondary/20 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold">Security First</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              JWT authentication, bcrypt password hashing, rate limiting, and CORS protection built into every request.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
