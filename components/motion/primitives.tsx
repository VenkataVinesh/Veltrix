'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '@/lib/use-lenis'
import { cn } from '@/lib/utils'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/* ─── Preloader ─────────────────────────────────────────────────
   Counter 0→100 then a curtain wipe. Skipped entirely under
   reduced motion so nobody is trapped behind an animation. */
export function Preloader({ label = 'VELTRIX' }: { label?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const reduce = typeof window !== 'undefined' && prefersReducedMotion()
  const [n, setN] = useState(reduce ? 100 : 0)

  useEffect(() => {
    if (reduce) {
      gsap.set(root.current, { display: 'none' })
      return
    }
    document.body.style.overflow = 'hidden'

    // Failsafe: never leave the visitor behind a scroll-locked splash. If the
    // timeline hasn't finished in time — throttled rAF in a background tab, a
    // blocked bundle, anything — force the page open anyway.
    const release = () => {
      document.body.style.overflow = ''
      gsap.set(root.current, { display: 'none' })
      ScrollTrigger.refresh()
    }
    const failsafe = setTimeout(release, 4000)

    const counter = { v: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(failsafe)
        document.body.style.overflow = ''
        ScrollTrigger.refresh()
      },
    })
    tl.to(counter, {
      v: 100,
      duration: 1.25,
      ease: 'power2.inOut',
      onUpdate: () => setN(Math.round(counter.v)),
    })
      .to('[data-preload-bar]', { scaleX: 1, duration: 1.25, ease: 'power2.inOut' }, 0)
      .to('[data-preload-content]', { yPercent: -110, duration: 0.6, ease: 'power4.inOut' }, '+=0.1')
      .to(root.current, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' }, '-=0.35')
      .set(root.current, { display: 'none' })

    return () => {
      clearTimeout(failsafe)
      tl.kill()
      document.body.style.overflow = ''
    }
  }, [reduce])

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[9999] flex flex-col justify-end bg-background"
      aria-hidden="true"
    >
      <div data-preload-content className="px-6 pb-[12vh] md:px-12">
        <div className="flex items-end justify-between">
          <span className="text-[clamp(3rem,12vw,10rem)] font-semibold leading-none tracking-[-0.04em]">
            {label}
          </span>
          <span className="tnum text-[clamp(1.5rem,4vw,3rem)] font-medium leading-none text-primary">
            {n}
          </span>
        </div>
        <div className="mt-8 h-px w-full overflow-hidden bg-border">
          <div data-preload-bar className="h-full origin-left scale-x-0 bg-primary" />
        </div>
      </div>
    </div>
  )
}

/* ─── Kinetic text ───────────────────────────────────────────────
   Splits into words and masks each behind a clip, revealing on a
   stagger. Under reduced motion the text simply renders. */
export function KineticText({
  children,
  className,
  delay = 0,
  as: Tag = 'span',
}: {
  children: string
  className?: string
  delay?: number
  as?: 'span' | 'h1' | 'h2' | 'p'
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const words = el.querySelectorAll('[data-word]')
    const anim = gsap.fromTo(
      words,
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.055,
        delay,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      }
    )
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [delay])

  return (
    <Tag ref={ref as never} className={className}>
      {children.split(' ').map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span data-word className="inline-block will-change-transform">
            {w}
            {i < children.split(' ').length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </Tag>
  )
}

/* ─── Scroll reveal ─────────────────────────────────────────────── */
export function Reveal({
  children, className, y = 34, delay = 0,
}: { children: React.ReactNode; className?: string; y?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const anim = gsap.fromTo(
      el,
      { y, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.95, ease: 'power3.out', delay,
        scrollTrigger: { trigger: el, start: 'top 90%' },
      }
    )
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [y, delay])

  return <div ref={ref} className={className}>{children}</div>
}

/* ─── Magnetic wrapper ──────────────────────────────────────────── */
export function Magnetic({
  children, strength = 0.32, className,
}: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.7, ease: 'power3.out',
      })
    }
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.4)' })

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [strength])

  return <div ref={ref} className={cn('inline-block', className)}>{children}</div>
}

/* ─── Custom cursor ─────────────────────────────────────────────
   Purely additive: the system cursor is never hidden, and this
   is skipped on touch devices and under reduced motion. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return
    const el = dot.current
    if (!el) return

    gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 })
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' })

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX); yTo(e.clientY)
      gsap.to(el, { opacity: 1, duration: 0.2 })
      const t = e.target as HTMLElement
      setActive(Boolean(t.closest('a,button,[data-cursor]')))
    }
    const onLeave = () => gsap.to(el, { opacity: 0, duration: 0.2 })

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
        'pointer-events-none fixed left-0 top-0 z-[9998] hidden rounded-full transition-[width,height,background-color] duration-300 lg:block',
        active ? 'h-12 w-12 bg-primary/25' : 'h-2.5 w-2.5 bg-primary'
      )}
    />
  )
}

/* ─── Marquee ───────────────────────────────────────────────────── */
export function Marquee({
  children, speed = 34, className,
}: { children: React.ReactNode; speed?: number; className?: string }) {
  return (
    <div className={cn('relative flex overflow-hidden', className)}>
      <div
        data-marquee
        className="flex shrink-0 animate-[marquee_linear_infinite] items-center gap-10 pr-10"
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
      <div
        data-marquee
        aria-hidden="true"
        className="flex shrink-0 animate-[marquee_linear_infinite] items-center gap-10 pr-10"
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─── Count up ──────────────────────────────────────────────────── */
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
      v: to, duration: 1.6, ease: 'power2.out',
      onUpdate: () => { el.textContent = render(obj.v) },
      scrollTrigger: { trigger: el, start: 'top 92%' },
    })
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [to, decimals, prefix, suffix])

  return <span ref={ref} className={cn('tnum', className)}>{prefix}0{suffix}</span>
}

/* ─── Pinned horizontal scroller ────────────────────────────────
   Falls back to a normal horizontal-swipe row under reduced motion. */
export function HorizontalScroller({
  children, className,
}: { children: React.ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)

  const setup = useCallback(() => {
    const o = outer.current, t = track.current
    if (!o || !t) return
    if (prefersReducedMotion() || window.innerWidth < 1024) return
    setPinned(true)

    const distance = t.scrollWidth - window.innerWidth
    if (distance <= 0) return

    const anim = gsap.to(t, {
      x: -distance,
      ease: 'none',
      scrollTrigger: {
        trigger: o,
        start: 'top top',
        end: () => `+=${distance}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    })
    return () => { anim.scrollTrigger?.kill(); anim.kill() }
  }, [])

  useEffect(() => {
    const cleanup = setup()
    return cleanup
  }, [setup])

  return (
    <div ref={outer} className={className}>
      <div
        ref={track}
        className={cn(
          'flex gap-5',
          !pinned && 'overflow-x-auto pb-4 [scrollbar-width:none]'
        )}
      >
        {children}
      </div>
    </div>
  )
}

/* ─── Grain overlay ─────────────────────────────────────────────── */
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
