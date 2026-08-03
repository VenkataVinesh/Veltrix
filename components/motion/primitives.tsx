'use client'

import {
  useEffect, useRef, useState, useMemo, useCallback, type ReactNode,
} from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion, INTRO_EVENT } from '@/lib/use-lenis'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/* ════════════════════════════════════════════════════════════════
   Intro coordination
   ────────────────────────────────────────────────────────────────
   The preloader holds a curtain over the page for ~2.5s. Anything
   above the fold that animates on a *scroll trigger* satisfies that
   trigger at t=0 — so it played out underneath the curtain and the
   page looked completely static by the time the visitor saw it.

   Hero-level motion therefore waits on this signal instead of on a
   scroll position it already occupies.
   ═══════════════════════════════════════════════════════════════ */

let introDone = false

export function markIntroDone() {
  if (introDone) return
  introDone = true
  window.dispatchEvent(new Event(INTRO_EVENT))
}

/** Resolves when the curtain is gone — or immediately under reduced motion. */
export function useIntroReady() {
  const [ready, setReady] = useState(
    () => introDone || (typeof window !== 'undefined' && prefersReducedMotion())
  )

  useEffect(() => {
    if (ready) return
    if (introDone) { setReady(true); return }
    const on = () => setReady(true)
    window.addEventListener(INTRO_EVENT, on)
    // Belt and braces: never strand content behind an intro that never fires.
    const bail = setTimeout(() => { markIntroDone(); setReady(true) }, 5000)
    return () => {
      window.removeEventListener(INTRO_EVENT, on)
      clearTimeout(bail)
    }
  }, [ready])

  return ready
}

/* ════════════════════════════════════════════════════════════════
   Preloader — counter, drawing rule, then a staggered column wipe
   ═══════════════════════════════════════════════════════════════ */

const COLUMNS = 6

export function Preloader({ label = 'VELTRIX' }: { label?: string }) {
  const root = useRef<HTMLDivElement>(null)
  // Always start at 0 so server and client agree; the effect corrects it.
  const [n, setN] = useState(0)

  useEffect(() => {
    // Reduced motion, or a client-side return to the landing page — don't
    // make anyone sit through the curtain twice.
    if (prefersReducedMotion() || introDone) {
      setN(100)
      gsap.set(root.current, { display: 'none' })
      markIntroDone()
      return
    }

    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)

    const release = () => {
      document.body.style.overflow = ''
      gsap.set(root.current, { display: 'none' })
      ScrollTrigger.refresh()
      markIntroDone()
    }
    // Throttled rAF in a background tab, a slow bundle — never trap the visitor.
    const failsafe = setTimeout(release, 4000)

    const counter = { v: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(failsafe)
        document.body.style.overflow = ''
        ScrollTrigger.refresh()
        markIntroDone()
      },
    })

    tl.to(counter, {
      v: 100,
      duration: 1.15,
      ease: 'power2.inOut',
      onUpdate: () => setN(Math.round(counter.v)),
    })
      .to('[data-preload-bar]', { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0)
      .to('[data-preload-content]', { yPercent: -125, duration: 0.65, ease: 'power4.inOut' }, '+=0.08')
      .to(
        '[data-preload-col]',
        { scaleY: 0, duration: 0.85, ease: 'power4.inOut', stagger: 0.06 },
        '-=0.42'
      )
      .set(root.current, { display: 'none' })

    return () => {
      clearTimeout(failsafe)
      tl.kill()
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div ref={root} className="fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      {/* Columns are the actual backdrop — they peel away to reveal the page. */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: COLUMNS }, (_, i) => (
          <div
            key={i}
            data-preload-col
            className="h-full flex-1 origin-top bg-background"
            style={{ willChange: 'transform' }}
          />
        ))}
      </div>

      <div className="relative flex h-full flex-col justify-end">
        <div data-preload-content className="px-6 pb-[12vh] md:px-12">
          <div className="flex items-end justify-between gap-6">
            <span className="text-[clamp(2.6rem,12vw,10rem)] font-semibold leading-none tracking-[-0.05em]">
              {label}
            </span>
            <span className="tnum text-[clamp(1.4rem,4vw,3rem)] font-medium leading-none text-primary">
              {n}
            </span>
          </div>
          <div className="mt-8 h-px w-full overflow-hidden bg-border">
            <div data-preload-bar className="h-full origin-left scale-x-0 bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Split text — masked word/char reveal
   ═══════════════════════════════════════════════════════════════ */

export function SplitText({
  children,
  className,
  as: Tag = 'span',
  mode = 'words',
  trigger = 'scroll',
  delay = 0,
  stagger,
}: {
  children: string
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
  mode?: 'words' | 'chars'
  trigger?: 'scroll' | 'intro'
  delay?: number
  stagger?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const introReady = useIntroReady()
  const words = useMemo(() => children.split(' '), [children])

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    if (trigger === 'intro' && !introReady) {
      // Park it off-stage so it can't play out behind the curtain.
      gsap.set(el.querySelectorAll(mode === 'chars' ? '[data-ch]' : '[data-w]'), { yPercent: 120 })
      return
    }

    const targets = el.querySelectorAll(mode === 'chars' ? '[data-ch]' : '[data-w]')
    if (!targets.length) return

    const vars: gsap.TweenVars = {
      yPercent: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: stagger ?? (mode === 'chars' ? 0.024 : 0.075),
      delay,
    }

    if (trigger === 'intro') {
      const anim = gsap.fromTo(targets, { yPercent: 120 }, vars)
      return () => { anim.kill() }
    }

    const anim = gsap.fromTo(targets, { yPercent: 120 }, {
      ...vars,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    })
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [introReady, trigger, mode, delay, stagger])

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((w, i) => (
        // pb/-mb pair keeps descenders (g, y, p) from being sliced by the mask.
        <span
          key={`${w}-${i}`}
          className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em]"
        >
          <span data-w className="inline-block will-change-transform">
            {mode === 'chars'
              ? Array.from(w).map((ch, j) => (
                  <span data-ch key={j} className="inline-block will-change-transform">
                    {ch}
                  </span>
                ))
              : w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </Tag>
  )
}

/* ════════════════════════════════════════════════════════════════
   Reveal — travel + fade + defocus
   ═══════════════════════════════════════════════════════════════ */

export function Reveal({
  children, className, y = 64, delay = 0, blur = true,
}: {
  children: ReactNode
  className?: string
  y?: number
  delay?: number
  blur?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(
      el,
      { y, opacity: 0, filter: blur ? 'blur(12px)' : 'blur(0px)' },
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1.15,
        ease: 'power3.out',
        delay,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      }
    )
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [y, delay, blur])

  return <div ref={ref} className={className}>{children}</div>
}

/* ════════════════════════════════════════════════════════════════
   Parallax — scrubbed, tied to scroll position
   ═══════════════════════════════════════════════════════════════ */

export function Parallax({
  children, className, speed = 0.18,
}: { children: ReactNode; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(
      el,
      { yPercent: -speed * 100 },
      {
        yPercent: speed * 100,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    )
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [speed])

  return <div ref={ref} className={className}>{children}</div>
}

/* ════════════════════════════════════════════════════════════════
   Scroll progress rail
   ═══════════════════════════════════════════════════════════════ */

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.set(el, { scaleX: 0, transformOrigin: 'left center' })
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => gsap.set(el, { scaleX: self.progress }),
    })
    return () => st.kill()
  }, [])

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[70] h-[2px] bg-transparent">
      <div ref={ref} className="h-full w-full bg-primary" />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Scroll-reactive marquee — speeds up and skews with scroll velocity
   ═══════════════════════════════════════════════════════════════ */

export function Marquee({
  children, speed = 60, reverse = false, className,
}: { children: ReactNode; speed?: number; reverse?: boolean; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = track.current
    const w = wrap.current
    if (!t || !w || prefersReducedMotion()) return

    let tween: gsap.core.Tween | null = null
    let boost = 1
    let skew = 0

    const build = () => {
      tween?.kill()
      const half = t.scrollWidth / 2
      if (half < 10) return false
      tween = gsap.fromTo(
        t,
        { x: reverse ? -half : 0 },
        { x: reverse ? 0 : -half, duration: half / speed, ease: 'none', repeat: -1 }
      )
      return true
    }

    // Measure now rather than deferring to rAF: a tab opened in the
    // background gets no animation frames at all, so a rAF-only setup
    // leaves the marquee dead until the tab is focused.
    const raf = build() ? 0 : requestAnimationFrame(build)

    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const v = self.getVelocity()
        boost = gsap.utils.clamp(1, 4.5, 1 + Math.abs(v) / 900)
        skew = gsap.utils.clamp(-6, 6, -v / 420)
      },
    })

    // Self-decaying: ScrollTrigger stops firing when scrolling stops, so the
    // boost has to ease itself back to rest on the ticker instead.
    const tick = () => {
      boost += (1 - boost) * 0.055
      skew += (0 - skew) * 0.055
      tween?.timeScale(boost)
      gsap.set(w, { skewX: skew })
    }
    gsap.ticker.add(tick)

    const onResize = () => build()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      gsap.ticker.remove(tick)
      window.removeEventListener('resize', onResize)
      st.kill()
      tween?.kill()
    }
  }, [speed, reverse])

  return (
    <div ref={wrap} className={cn('relative flex overflow-hidden', className)}>
      <div ref={track} className="flex shrink-0 will-change-transform">
        <div className="flex shrink-0 items-center gap-10 pr-10">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 items-center gap-10 pr-10">{children}</div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Progressive text highlight — words brighten as you scroll through
   ═══════════════════════════════════════════════════════════════ */

export function HighlightText({
  children, className,
}: { children: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const words = useMemo(() => children.split(' '), [children])

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const targets = el.querySelectorAll('[data-hw]')
    const anim = gsap.fromTo(
      targets,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.35,
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          end: 'bottom 58%',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      }
    )
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [])

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span data-hw key={`${w}-${i}`} className="inline-block">
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}

/* ════════════════════════════════════════════════════════════════
   Magnetic wrapper
   ═══════════════════════════════════════════════════════════════ */

export function Magnetic({
  children, strength = 0.34, className,
}: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.7,
        ease: 'power3.out',
      })
    }
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,0.36)' })

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [strength])

  return <div ref={ref} className={cn('inline-block', className)}>{children}</div>
}

/* ════════════════════════════════════════════════════════════════
   Custom cursor — the system cursor is never hidden
   ═══════════════════════════════════════════════════════════════ */

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return
    const el = dot.current
    if (!el) return

    gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 })
    const xTo = gsap.quickTo(el, 'x', { duration: 0.42, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.42, ease: 'power3' })

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX); yTo(e.clientY)
      gsap.to(el, { opacity: 1, duration: 0.2, overwrite: 'auto' })
      const t = e.target as HTMLElement
      setActive(Boolean(t.closest('a,button,[data-cursor]')))
    }
    const onLeave = () => gsap.to(el, { opacity: 0, duration: 0.2, overwrite: 'auto' })

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={dot}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 top-0 z-[9998] hidden rounded-full ring-1 ring-primary/60 transition-[width,height,background-color] duration-300 lg:block',
        active ? 'h-14 w-14 bg-primary/15' : 'h-2.5 w-2.5 bg-primary'
      )}
    />
  )
}

/* ════════════════════════════════════════════════════════════════
   Count up
   ═══════════════════════════════════════════════════════════════ */

export function CountUp({
  to, decimals = 0, prefix = '', suffix = '', className,
}: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const render = (v: number) =>
      `${prefix}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      })}${suffix}`

    if (prefersReducedMotion()) { el.textContent = render(to); return }

    const obj = { v: 0 }
    const anim = gsap.to(obj, {
      v: to,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = render(obj.v) },
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    })
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [to, decimals, prefix, suffix])

  return <span ref={ref} className={cn('tnum', className)}>{prefix}0{suffix}</span>
}

/* ════════════════════════════════════════════════════════════════
   Pinned horizontal gallery
   ───────────────────────────────────────────────────────────────
   Pins the section and converts vertical scroll into horizontal
   travel. Below lg — and under reduced motion — it degrades to an
   ordinary swipeable row.
   ═══════════════════════════════════════════════════════════════ */

export function PinnedGallery({
  children, className, heading,
}: { children: ReactNode; className?: string; heading?: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const o = outer.current, t = track.current
    if (!o || !t) return
    if (prefersReducedMotion() || window.innerWidth < 1024) return

    let anim: gsap.core.Tween | null = null

    const build = () => {
      anim?.scrollTrigger?.kill()
      anim?.kill()
      const distance = t.scrollWidth - window.innerWidth + 96
      if (distance <= 0) return false
      setPinned(true)
      anim = gsap.to(t, {
        x: -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: o,
          start: 'top top',
          end: () => `+=${distance}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar.current) gsap.set(bar.current, { scaleX: self.progress })
          },
        },
      })
      return true
    }

    // Synchronous first attempt — see the note in Marquee. A background tab
    // never delivers an animation frame, so a rAF-only build leaves the
    // gallery unpinned and overflowing.
    const raf = build() ? 0 : requestAnimationFrame(build)
    return () => {
      cancelAnimationFrame(raf)
      anim?.scrollTrigger?.kill()
      anim?.kill()
    }
  }, [])

  return (
    <div ref={outer} className={cn('flex h-auto flex-col justify-center lg:h-screen', className)}>
      {heading}
      <div
        ref={track}
        className={cn(
          'flex gap-6',
          !pinned && 'overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none]'
        )}
      >
        {children}
      </div>
      {pinned && (
        <div className="mx-6 mt-14 h-px bg-border md:mx-12">
          <div ref={bar} className="h-full w-full origin-left scale-x-0 bg-primary" />
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Scroll-drawn line chart
   ───────────────────────────────────────────────────────────────
   The path is built from the real close series passed in and its
   stroke is scrubbed by scroll position, so the chart literally
   draws itself as the section passes. No synthetic data.
   ═══════════════════════════════════════════════════════════════ */

const CW = 1000, CH = 300, CPAD = 14

export function DrawChart({ series, className }: { series: number[]; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)

  const { line, area } = useMemo(() => {
    if (series.length < 2) return { line: '', area: '' }
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const pts = series.map((v, i) => {
      const x = (i / (series.length - 1)) * CW
      const y = CPAD + (1 - (v - min) / span) * (CH - CPAD * 2)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    const l = `M${pts.join(' L')}`
    return { line: l, area: `${l} L${CW},${CH} L0,${CH} Z` }
  }, [series])

  useEffect(() => {
    const el = wrap.current
    const path = pathRef.current
    if (!el || !path || !line) return

    const len = path.getTotalLength()

    if (prefersReducedMotion()) {
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 })
      gsap.set(areaRef.current, { opacity: 1 })
      return
    }

    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
    gsap.set(areaRef.current, { opacity: 0 })

    // fromTo, not to — the start value is then explicit, so a refresh can
    // re-derive the tween instead of latching whatever offset it happens to
    // be sitting at.
    const anim = gsap.fromTo(path, { strokeDashoffset: len }, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top 82%',
        end: 'bottom 62%',
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Ride a marker along the stroke as it draws.
          const p = path.getPointAtLength(len * self.progress)
          if (dotRef.current) {
            gsap.set(dotRef.current, { attr: { cx: p.x, cy: p.y }, opacity: self.progress > 0.01 ? 1 : 0 })
          }
          if (areaRef.current) gsap.set(areaRef.current, { opacity: self.progress * 0.9 })
        },
      },
    })

    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [line])

  if (!line) {
    return <div className={cn('h-[300px] w-full animate-pulse rounded-2xl bg-elevated/50', className)} />
  }

  return (
    <div ref={wrap} className={className}>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="veltrix-draw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={areaRef} d={area} fill="url(#veltrix-draw-fill)" />
        <path
          ref={pathRef}
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle ref={dotRef} r="5" fill="var(--primary)" opacity="0" />
      </svg>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Grain overlay
   ═══════════════════════════════════════════════════════════════ */

export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  )
}

/* ════════════════════════════════════════════════════════════════
   Scrubbed hero exit — content lifts and defocuses as you leave
   ═══════════════════════════════════════════════════════════════ */

export function useHeroExit(
  section: React.RefObject<HTMLElement | null>,
  content: React.RefObject<HTMLElement | null>,
  canvas: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const s = section.current
    if (!s) return

    const anims: gsap.core.Tween[] = []
    if (content.current) {
      anims.push(gsap.to(content.current, {
        yPercent: -22, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: s, start: 'top top', end: 'bottom top', scrub: true },
      }))
    }
    if (canvas.current) {
      anims.push(gsap.to(canvas.current, {
        scale: 1.18, yPercent: 10, ease: 'none',
        scrollTrigger: { trigger: s, start: 'top top', end: 'bottom top', scrub: true },
      }))
    }
    return () => anims.forEach((a) => { a.scrollTrigger?.kill(); a.kill() })
  }, [section, content, canvas])
}

/* Convenience: tracks which of a set of `[data-chapter]` elements is active. */
export function useActiveChapter(count: number) {
  const [active, setActive] = useState(0)

  const attach = useCallback(() => {
    const els = gsap.utils.toArray<HTMLElement>('[data-chapter]')
    return els.map((el, i) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 60%',
        end: 'bottom 60%',
        onToggle: (self) => { if (self.isActive) setActive(i) },
      })
    )
  }, [])

  useEffect(() => {
    const sts = attach()
    return () => sts.forEach((s) => s.kill())
  }, [attach, count])

  return active
}
