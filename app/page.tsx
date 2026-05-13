'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue } from 'framer-motion'
import Link from 'next/link'
import Lenis from 'lenis'
import {
  ArrowRight, BarChart3, Brain, Shield, Sparkles, TrendingUp,
  LineChart, Globe2, SlidersHorizontal, Cpu, Activity, Zap, CheckCircle2,
  ChevronDown
} from 'lucide-react'

const FEATURES = [
  { icon: LineChart, title: 'Institutional Charts', description: 'TradingView-quality candlestick charts with realtime crosshair, EMA/SMA/Bollinger overlays.' },
  { icon: Brain, title: 'AI Intelligence Core', description: 'Multi-agent signal generation with technical analysis, ML ensemble forecasts, and explainable reasoning.' },
  { icon: Shield, title: 'Risk Engine', description: 'VaR, expected shortfall, stress testing, Monte Carlo simulation, and concentration risk monitoring.' },
  { icon: Globe2, title: 'Macro Intel', description: 'Global macro feeds, rate monitoring, commodity tracking, and cross-asset regime analysis.' },
  { icon: BarChart3, title: 'Portfolio Analytics', description: 'Sharpe, Sortino, Alpha, Beta, information ratio, attribution analysis, and sector exposure.' },
  { icon: SlidersHorizontal, title: 'Portfolio Optimizer', description: 'Mean-variance optimization with efficient frontier, sector constraints, and growth projections.' },
  { icon: TrendingUp, title: 'Institutional Flow', description: 'Real-time smart money flow detection from volume spikes, momentum analysis, and dark pool proxy.' },
  { icon: Cpu, title: 'AI Copilot', description: 'Context-aware streaming assistant with portfolio, risk, and market intelligence.' },
]

const TICKER_DATA = [
  { symbol: 'SPY', value: '565.42', change: '+1.24%', up: true },
  { symbol: 'QQQ', value: '487.18', change: '+2.18%', up: true },
  { symbol: 'AAPL', value: '213.55', change: '+0.87%', up: true },
  { symbol: 'NVDA', value: '142.30', change: '+3.42%', up: true },
  { symbol: 'TSLA', value: '172.82', change: '-1.15%', up: false },
  { symbol: 'BTC', value: '103,500', change: '+4.23%', up: true },
]

function AnimatedTicker() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-10 border-t border-white/5 bg-black/40 backdrop-blur-md overflow-hidden flex items-center z-50">
      <motion.div
        className="flex items-center gap-12 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        {[...TICKER_DATA, ...TICKER_DATA, ...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-muted-foreground">{item.symbol}</span>
            <span className="text-xs font-mono text-foreground/80">{item.value}</span>
            <span className={`text-xs font-mono font-medium ${item.up ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

function GridBackground({ scrollYProgress }: { scrollYProgress: any }) {
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <motion.div style={{ y, opacity }} className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep cinematic gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#020204]" />
      
      {/* Top electric blue/cyan glow */}
      <div className="absolute top-[-20%] left-[20%] w-[80%] h-[60%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_60%)] blur-[100px]" />
      {/* Side deep purple/magenta glow */}
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[70%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1),transparent_60%)] blur-[120px]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />
      
      {/* Scanning laser line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.5)]"
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  )
}

function CinematicSection({ children, index }: { children: React.ReactNode, index: number }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  
  const y = useTransform(scrollYProgress, [0, 1], [150, -150])
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95])

  return (
    <motion.section ref={ref} style={{ y, opacity, scale }} className="relative py-32 px-6 flex items-center justify-center min-h-screen">
      {children}
    </motion.section>
  )
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ delay: index * 0.1, duration: 0.8, type: "spring", stiffness: 50 }}
      whileHover={{ y: -8, scale: 1.02, rotateX: 5, rotateY: -5 }}
      className="group relative rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-md overflow-hidden transform-gpu"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <motion.div
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:from-cyan-500/40 group-hover:to-purple-500/40 transition-colors duration-500 border border-white/5 shadow-inner"
        whileHover={{ rotate: 180, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <feature.icon className="w-6 h-6 text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
      </motion.div>
      <h3 className="text-xl font-bold mb-3 text-white tracking-tight">{feature.title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
    </motion.div>
  )
}

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, { damping: 20, stiffness: 100 })

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  // Parallax elements for hero
  const heroY = useTransform(smoothProgress, [0, 1], ['0%', '100%'])
  const heroScale = useTransform(smoothProgress, [0, 0.2], [1, 0.85])
  const heroOpacity = useTransform(smoothProgress, [0, 0.15], [1, 0])

  return (
    <div ref={containerRef} className="min-h-[300vh] bg-[#050508] text-white selection:bg-cyan-500/30 font-sans overflow-x-hidden">
      
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 origin-left z-50"
        style={{ scaleX: smoothProgress }}
      />

      {/* Nav */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.2, type: "spring" }}
        className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-black/20 backdrop-blur-2xl"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-20 px-8">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              whileHover={{ scale: 1.1, rotate: 90 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <span className="text-xl font-black text-black">V</span>
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tighter text-white drop-shadow-md">VELTRIX</span>
              <span className="text-[9px] text-cyan-400 tracking-[0.4em] font-medium uppercase">Terminal</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors relative group">
              Sign in
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-cyan-400 transition-all group-hover:w-full"></span>
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/signup"
                className="relative inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 transition-transform duration-500 group-hover:scale-105"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden perspective-[1000px]">
        <GridBackground scrollYProgress={scrollYProgress} />
        <AnimatedTicker />

        <motion.div 
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative z-10 w-full max-w-5xl mx-auto text-center px-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 1.2, type: "spring", bounce: 0.4 }}
            className="inline-flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-medium text-cyan-300 mb-10 backdrop-blur-sm shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
              Institutional-grade AI financial terminal
            </div>

            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8 leading-[0.85] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 drop-shadow-2xl">
              Trading, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-gradient-x">
                Elevated.
              </span>
            </h1>

            <p className="text-lg md:text-2xl text-white/60 max-w-3xl mx-auto mb-14 leading-relaxed font-light">
              Experience the cinematic future of finance. Realtime market data, AI-powered signals, and risk management—forged for precision.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex items-center justify-center gap-6"
            >
              <Link
                href="/signup"
                className="group relative inline-flex items-center justify-center gap-3 rounded-full px-10 py-5 text-lg font-bold text-white overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.4)] transition-all hover:shadow-[0_0_60px_rgba(6,182,212,0.6)] hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 bg-[length:200%_auto] animate-gradient-x"></div>
                <span className="relative z-10">Launch Terminal</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-2 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
        >
          <span className="text-xs uppercase tracking-[0.3em] font-medium">Scroll</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Cinematic Showcase Section */}
      <CinematicSection index={1}>
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Intelligence at Scale
            </h2>
            <p className="text-xl text-white/50 max-w-2xl mx-auto">
              A symphony of algorithms and beautiful design, delivering unparalleled insights.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 perspective-[2000px]">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </CinematicSection>

      {/* Stats Section with Parallax Image/Glow */}
      <CinematicSection index={2}>
         <div className="relative w-full max-w-6xl mx-auto rounded-[3rem] border border-white/10 bg-black/50 backdrop-blur-2xl p-16 md:p-24 overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.15)]">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />
            
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
              {[
                { icon: Zap, label: 'Execution', value: '<50ms' },
                { icon: Brain, label: 'AI Debate', value: '4 Agents' },
                { icon: Shield, label: 'Risk Models', value: '8+ Tests' },
                { icon: Globe2, label: 'Markets', value: 'Global' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, type: "spring" }}
                  className="space-y-4"
                >
                  <item.icon className="w-10 h-10 text-cyan-400 mx-auto drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  <div className="text-4xl md:text-5xl font-black font-mono text-white tracking-tight">{item.value}</div>
                  <div className="text-sm font-medium tracking-widest text-white/50 uppercase">{item.label}</div>
                </motion.div>
              ))}
            </div>
         </div>
      </CinematicSection>

      {/* Final CTA Section */}
      <CinematicSection index={3}>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, type: "spring", bounce: 0.5 }}
            className="mb-12 inline-block"
          >
             <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 p-[2px] mx-auto shadow-[0_0_60px_rgba(168,85,247,0.5)]">
                <div className="w-full h-full bg-black rounded-[22px] flex items-center justify-center">
                   <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-600">V</span>
                </div>
             </div>
          </motion.div>
          <h2 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30">
            The Future is Here.
          </h2>
          <p className="text-2xl text-white/50 mb-12 font-light">
            Step into the next generation of institutional trading.
          </p>
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center gap-3 rounded-full px-12 py-6 text-xl font-bold text-black bg-white overflow-hidden transition-transform hover:scale-105"
          >
            <span className="relative z-10">Get Started Now</span>
            <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </CinematicSection>
      
      {/* Footer */}
      <footer className="relative z-10 py-10 px-8 border-t border-white/10 bg-black/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-60">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-[10px] font-black text-black">V</span>
            </div>
            <span className="text-xs font-bold tracking-widest">VELTRIX TERMINAL</span>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Veltrix. All systems operational.
          </p>
        </div>
      </footer>
    </div>
  )
}
