'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/use-lenis'

/**
 * Generative hero: the real price series IS the artwork.
 *
 * Takes live BTC closes, normalises them to a path, then draws several
 * phase-offset ribbons with additive glow so the series reads as a
 * flowing field rather than a chart. Cursor adds parallax.
 *
 * Canvas 2D rather than WebGL — with additive blending and layered glow
 * it hits the same visual bar, runs everywhere, and degrades cleanly.
 * Under reduced motion it paints one static frame.
 */

const LIME = [198, 242, 78] as const
const LAYERS = 5

export function HeroCanvas({ series }: { series: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduce = prefersReducedMotion()
    // Fall back to a gentle synthetic wave if the feed hasn't arrived yet,
    // so the hero is never blank.
    const data = series.length > 8
      ? series
      : Array.from({ length: 120 }, (_, i) => Math.sin(i / 9) * 0.5 + Math.sin(i / 23) * 0.3)

    const min = Math.min(...data)
    const max = Math.max(...data)
    const span = max - min || 1
    const norm = data.map((v) => (v - min) / span) // 0..1

    let raf = 0
    let w = 0, h = 0, dpr = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width; h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawRibbon = (t: number, layer: number) => {
      const depth = layer / LAYERS
      const amp = h * (0.17 - depth * 0.021)
      const yBase = h * (0.52 + depth * 0.055)
      const phase = t * (0.16 + layer * 0.045) + layer * 1.05
      const px = (pointer.current.x - 0.5) * (34 + layer * 15)
      const py = (pointer.current.y - 0.5) * (22 + layer * 9)
      const alpha = 0.5 - depth * 0.36

      ctx.beginPath()
      const steps = norm.length
      for (let i = 0; i < steps; i++) {
        const p = i / (steps - 1)
        const x = p * (w + 220) - 110 + px
        // Real price shape + a slow travelling wave for life
        const drift = Math.sin(p * 5.2 + phase) * (h * 0.035)
        const y = yBase - (norm[i] - 0.5) * 2 * amp + drift + py
        if (i === 0) ctx.moveTo(x, y)
        else {
          // Smooth through midpoints so the line reads as a ribbon
          const pPrev = (i - 1) / (steps - 1)
          const xPrev = pPrev * (w + 220) - 110 + px
          const driftPrev = Math.sin(pPrev * 5.2 + phase) * (h * 0.035)
          const yPrev = yBase - (norm[i - 1] - 0.5) * 2 * amp + driftPrev + py
          ctx.quadraticCurveTo(xPrev, yPrev, (xPrev + x) / 2, (yPrev + y) / 2)
        }
      }

      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, `rgba(${LIME[0]},${LIME[1]},${LIME[2]},0)`)
      grad.addColorStop(0.22, `rgba(${LIME[0]},${LIME[1]},${LIME[2]},${alpha})`)
      grad.addColorStop(0.78, `rgba(${LIME[0]},${LIME[1]},${LIME[2]},${alpha})`)
      grad.addColorStop(1, `rgba(${LIME[0]},${LIME[1]},${LIME[2]},0)`)

      ctx.strokeStyle = grad
      ctx.lineWidth = 2.2 - depth * 1.1
      ctx.lineCap = 'round'
      ctx.shadowColor = `rgba(${LIME[0]},${LIME[1]},${LIME[2]},${0.55 - depth * 0.4})`
      ctx.shadowBlur = 26 - depth * 14
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    const frame = (ms: number) => {
      const t = ms / 1000
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (let l = LAYERS - 1; l >= 0; l--) drawRibbon(t, l)
      ctx.globalCompositeOperation = 'source-over'

      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.045
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.045

      raf = requestAnimationFrame(frame)
    }

    const onPointer = (e: PointerEvent) => {
      pointer.current.tx = e.clientX / window.innerWidth
      pointer.current.ty = e.clientY / window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    if (reduce) {
      ctx.globalCompositeOperation = 'lighter'
      for (let l = LAYERS - 1; l >= 0; l--) drawRibbon(6, l)
      ctx.globalCompositeOperation = 'source-over'
    } else {
      window.addEventListener('pointermove', onPointer)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [series])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  )
}
