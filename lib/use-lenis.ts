'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
  if (process.env.NODE_ENV !== 'production') {
    ;(window as unknown as Record<string, unknown>).ScrollTrigger = ScrollTrigger
    ;(window as unknown as Record<string, unknown>).gsap = gsap
  }
}

/** Fired once the preloader curtain is gone. Defined here so `primitives`
 *  can import it without creating a cycle back into this module. */
export const INTRO_EVENT = 'veltrix:intro-done'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Momentum smooth-scroll, driven off GSAP's ticker so ScrollTrigger stays in sync. */
export function useLenis() {
  useEffect(() => {
    if (prefersReducedMotion()) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    })

    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Triggers created while the preloader still had `body { overflow: hidden }`
    // measured against an unscrollable document, so their start/end collapsed
    // to 0. Recompute once the page is genuinely scrollable, and again after
    // fonts and images settle the layout.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener(INTRO_EVENT, refresh)
    window.addEventListener('load', refresh)
    const settle = setTimeout(refresh, 600)

    return () => {
      clearTimeout(settle)
      window.removeEventListener(INTRO_EVENT, refresh)
      window.removeEventListener('load', refresh)
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [])
}
