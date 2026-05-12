'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, LineChart, Briefcase, LayoutDashboard, ArrowRight, Check } from 'lucide-react'

const STEPS = [
  {
    title: 'Welcome to Veltrix Terminal',
    description: 'Your institutional-grade AI trading platform. Realtime market data, AI signals, portfolio analytics, and risk management — all in one terminal.',
    icon: Sparkles,
  },
  {
    title: 'Set Up Your Watchlist',
    description: 'Track the assets that matter to you. Use the Markets view to explore symbols and add them to your personalized watchlist.',
    icon: LineChart,
  },
  {
    title: 'Build Your Portfolio',
    description: 'Add positions and track your holdings with realtime P&L, sector allocation, and risk metrics. All values are derived from live market data.',
    icon: Briefcase,
  },
  {
    title: 'Explore the Terminal',
    description: 'Use 1-9 for navigation, ⌘K for quick search, and ⌘I for AI Copilot. Each section provides institutional-grade analytics and tools.',
    icon: LayoutDashboard,
  },
]

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-2xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 mx-auto">
          <Icon className="w-7 h-7 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-center mb-3">{current.title}</h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8">{current.description}</p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-4 bg-secondary'}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setStep(3); onComplete() }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Skip
          </button>
          <button
            onClick={() => {
              if (step < STEPS.length - 1) setStep(step + 1)
              else onComplete()
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Get Started <Check className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
