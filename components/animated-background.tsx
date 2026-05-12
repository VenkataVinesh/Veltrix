'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []
    
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
      color: string

      constructor(width: number, height: number) {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.3
        this.vy = (Math.random() - 0.5) * 0.3
        this.size = Math.random() * 2 + 0.5
        this.opacity = Math.random() * 0.5 + 0.1
        this.color = Math.random() > 0.7 ? '#f59e0b' : '#3b82f6'
      }

      update(width: number, height: number) {
        this.x += this.vx
        this.y += this.vy

        if (this.x < 0 || this.x > width) this.vx *= -1
        if (this.y < 0 || this.y > height) this.vy *= -1
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = this.color
        ctx.globalAlpha = this.opacity
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    const init = () => {
      resize()
      particles = []
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000)
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas.width, canvas.height))
      }
    }

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = '#3b82f6'
            ctx.globalAlpha = (1 - distance / 150) * 0.1
            ctx.lineWidth = 0.5
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(particle => {
        particle.update(canvas.width, canvas.height)
        particle.draw(ctx)
      })
      
      drawConnections()
      
      animationId = requestAnimationFrame(animate)
    }

    init()
    animate()

    window.addEventListener('resize', init)

    return () => {
      window.removeEventListener('resize', init)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f0f18] to-[#0a0a12]" />
      
      {/* Animated gradient mesh */}
      <motion.div
        className="absolute inset-0 opacity-30 animate-gradient"
        style={{
          background: 'radial-gradient(ellipse at 20% 30%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 70%)'
        }}
        animate={{
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
      
      {/* Neural particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-60"
      />
      
      {/* Volumetric lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px]" />
      
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"
          animate={{
            top: ['-10%', '110%'],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      </div>
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
