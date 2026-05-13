'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Cpu, Shield, TrendingUp, Sparkles, Activity, Zap, Lock, Mail } from 'lucide-react'
import { api } from '@/lib/api-client'

// Animated grid background particles
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Radial gradient center glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,rgba(59,130,246,0.08),transparent)]" />

      {/* Animated grid lines */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245,158,11,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.6) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"
        animate={{ top: ['10%', '90%', '10%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

// Live data ticker items for the login page
const TICKER_ITEMS = [
  { label: 'SPY', value: '+1.24%', up: true },
  { label: 'QQQ', value: '+2.18%', up: true },
  { label: 'AAPL', value: '+0.87%', up: true },
  { label: 'NVDA', value: '+3.42%', up: true },
  { label: 'TSLA', value: '-1.15%', up: false },
  { label: 'MSFT', value: '+1.56%', up: true },
  { label: 'BTC', value: '+4.23%', up: true },
  { label: 'GLD', value: '-0.34%', up: false },
]

function MarketTicker() {
  return (
    <div className="absolute top-0 left-0 right-0 h-8 bg-black/40 backdrop-blur-sm border-b border-white/5 overflow-hidden flex items-center">
      <motion.div
        className="flex items-center gap-8 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-semibold text-muted-foreground">{item.label}</span>
            <span className={`text-[11px] font-mono ${item.up ? 'text-emerald-400' : 'text-red-400'}`}>{item.value}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// Left panel feature bullets
const FEATURES = [
  { icon: Cpu, label: 'Multi-Agent AI Engine', desc: 'Neural signal generation across 50+ indicators' },
  { icon: Shield, label: 'Institutional Risk Engine', desc: 'VaR, CVaR, stress tests & scenario analysis' },
  { icon: TrendingUp, label: 'Realtime Market Data', desc: 'Polygon, Finnhub, AlphaVantage integrated' },
  { icon: Activity, label: 'Live WebSocket Feeds', desc: 'Sub-second data streaming to all panels' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: () => router.push('/dashboard'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="min-h-screen bg-[oklch(0.06_0.01_250)] flex overflow-hidden">
      <GridBackground />
      <MarketTicker />

      {/* Left Panel — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex flex-col justify-between w-1/2 pt-16 pb-12 pl-16 pr-12 relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-lg font-black text-black">V</span>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight">VELTRIX</span>
            <span className="text-[10px] text-amber-500/70 tracking-[0.4em] ml-2 font-medium">TERMINAL</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Institutional AI Trading Platform</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              The terminal{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">
                built for
              </span>
              {' '}precision.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-md">
              Real-time AI signals, institutional risk management, and portfolio analytics — unified in one command center.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="space-y-4"
          >
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex items-start gap-3 group"
              >
                <div className="mt-0.5 p-2 rounded-lg bg-secondary/50 border border-border/40 group-hover:border-amber-500/30 group-hover:bg-amber-500/5 transition-all">
                  <feature.icon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{feature.label}</div>
                  <div className="text-xs text-muted-foreground">{feature.desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { value: '4', label: 'Data Providers' },
            { value: '12+', label: 'Risk Metrics' },
            { value: '<50ms', label: 'Data Latency' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-amber-400 font-mono">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center pt-16 px-6 lg:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <span className="text-base font-black text-black">V</span>
            </div>
            <span className="text-lg font-bold">VELTRIX TERMINAL</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-2 text-muted-foreground">Access your institutional trading terminal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                emailFocused
                  ? 'border-amber-500/60 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
                  : 'border-border/60 hover:border-border'
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

            {/* Password field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <button type="button" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                passwordFocused
                  ? 'border-amber-500/60 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
                  : 'border-border/60 hover:border-border'
              }`}>
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••••••"
                  className="w-full bg-secondary/30 rounded-xl pl-10 pr-11 py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {loginMutation.isError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  Invalid credentials or service unavailable.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loginMutation.isPending || !email || !password}
              className="relative w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3.5 text-sm font-semibold text-black shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden group"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              {loginMutation.isPending ? (
                <>
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in to Terminal
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-[oklch(0.06_0.01_250)] px-3">or continue with demo</span>
            </div>
          </div>

          {/* Demo login */}
          <motion.button
            type="button"
            onClick={() => loginMutation.mutate({ email: 'demo@veltrix.ai', password: 'Demo123!' })}
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/20 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 hover:border-border transition-all duration-200 disabled:opacity-50"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Try Demo Account
          </motion.button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Create one
            </Link>
          </p>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground/60"
          >
            <Shield className="w-3 h-3" />
            <span>256-bit encryption · SOC 2 ready · Zero data sharing</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
