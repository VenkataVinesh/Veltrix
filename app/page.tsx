'use client'

import { useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, BarChart3, Brain, Shield, Sparkles, TrendingUp, LineChart, Globe2, SlidersHorizontal, Cpu } from 'lucide-react'

const FEATURES = [
  { icon: LineChart, title: 'Institutional Charts', description: 'TradingView-quality candlestick, line, and area charts with realtime crosshair, zoom, and indicator overlays.' },
  { icon: Brain, title: 'AI Intelligence Core', description: 'Multi-agent signal generation with technical analysis, ML ensemble forecasts, and explainable trade reasoning.' },
  { icon: Shield, title: 'Risk Engine', description: 'VaR, expected shortfall, stress testing, Monte Carlo simulation, and concentration risk monitoring.' },
  { icon: Globe2, title: 'Macro Intel', description: 'Global macro feeds, rate monitoring, commodity tracking, and recession probability modeling.' },
  { icon: BarChart3, title: 'Portfolio Analytics', description: 'Sharpe, Sortino, Alpha, Beta, attribution analysis, sector exposure, and historical equity curves.' },
  { icon: SlidersHorizontal, title: 'Portfolio Optimizer', description: 'Mean-variance optimization with efficient frontier, sector constraints, and growth projections.' },
  { icon: TrendingUp, title: 'Institutional Flow', description: 'Real-time smart money flow detection from volume spikes, momentum analysis, and dark pool proxies.' },
  { icon: Cpu, title: 'AI Copilot', description: 'Context-aware streaming assistant with portfolio, risk, and market intelligence.' },
]

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const Icon = feature.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className="group rounded-2xl border border-border/40 bg-card/50 p-6 hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
    </motion.div>
  )
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <span className="text-lg font-bold text-black">V</span>
            </div>
            <span className="font-bold text-lg tracking-tight">VELTRIX</span>
            <span className="text-[10px] text-muted-foreground tracking-[0.3em] hidden sm:block">TERMINAL</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs text-primary mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Institutional-grade AI financial terminal
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            The Terminal for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Intelligent Trading
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Realtime market data, AI-powered signals, portfolio analytics, risk management, and optimization —
            built for institutions that demand precision.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Launch Terminal <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-8 py-3.5 text-base font-medium hover:bg-secondary/50 transition-colors"
            >
              Sign In
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            {[
              { label: 'Data Providers', value: '4' },
              { label: 'Analytics Metrics', value: '12+' },
              { label: 'Tech Indicators', value: '7' },
              { label: 'ML Models', value: '3' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything an institution needs</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From realtime market data to portfolio optimization — Veltrix delivers professional-grade tools in a unified terminal experience.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to trade smarter?</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Join Veltrix Terminal and get institutional-grade market intelligence at your fingertips.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/30 text-center text-xs text-muted-foreground">
        VELTRIX TERMINAL &copy; {new Date().getFullYear()} &mdash; Institutional AI Trading Platform
      </footer>
    </div>
  )
}
