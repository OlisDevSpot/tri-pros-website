'use client'

import type { ShowroomProject } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'

interface Props {
  projects: ShowroomProject[]
}

/**
 * Asymmetric mosaic grid layout for the portfolio hero.
 *
 * 12-col × 6-row grid with 8 cells covering every pixel — no gaps.
 * Mix of large feature cells and smaller accent cells creates
 * visual rhythm and editorial feel.
 *
 * Layout (approximate):
 * ┌──────────┬────────┬──────────┐
 * │          │   B    │          │
 * │    A     ├────────┤    C     │
 * │          │   D    │          │
 * ├──────┬───┴────────┼──────────┤
 * │      │            │    G     │
 * │  E   │     F      ├──────────┤
 * │      │            │    H     │
 * └──────┴────────────┴──────────┘
 */
const CELLS: { col: string, row: string, delay: number }[] = [
  // Top-left feature (large)
  { col: '1 / 5', row: '1 / 4', delay: 0 },
  // Top-center
  { col: '5 / 9', row: '1 / 3', delay: 0.08 },
  // Top-right feature (tall)
  { col: '9 / 13', row: '1 / 4', delay: 0.12 },
  // Center accent (below B)
  { col: '5 / 9', row: '3 / 4', delay: 0.18 },
  // Bottom-left
  { col: '1 / 4', row: '4 / 7', delay: 0.22 },
  // Bottom-center feature (large)
  { col: '4 / 9', row: '4 / 7', delay: 0.28 },
  // Bottom-right top
  { col: '9 / 13', row: '4 / 5', delay: 0.32 },
  // Bottom-right bottom
  { col: '9 / 13', row: '5 / 7', delay: 0.36 },
]

const MOSAIC_COUNT = CELLS.length

export function ShowroomHero({ projects }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }

    function onScroll() {
      const rect = el!.getBoundingClientRect()
      const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1)
      setScrollProgress(progress)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const yValue = `${scrollProgress * 20}%`
  const opacityValue = Math.max(1 - scrollProgress / 0.8, 0)

  const heroProjects = useMemo(
    () => projects.filter(p => p.heroImage?.url).slice(0, MOSAIC_COUNT),
    [projects],
  )

  return (
    <section
      ref={containerRef}
      className="relative h-[85vh] min-h-150 overflow-hidden bg-background"
    >
      {/* Parallax mosaic grid */}
      {heroProjects.length >= 3 && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 will-change-transform"
          style={{ transform: `translateY(${yValue})` }}
        >
          <div className="grid h-full w-full grid-cols-12 grid-rows-6 gap-1 p-1 sm:gap-1.5 sm:p-1.5">
            {heroProjects.map((p, i) => {
              const cell = CELLS[i]
              if (!cell) {
                return null
              }
              return (
                <motion.div
                  key={p.project.id}
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.08 }}
                  transition={{
                    duration: 1.1,
                    delay: cell.delay,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="relative overflow-hidden rounded-lg"
                  style={{
                    gridColumn: cell.col,
                    gridRow: cell.row,
                  }}
                >
                  <OptimizedImage
                    file={p.heroImage!}
                    alt={p.project.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    priority={i < 3}
                  />
                  {/* Inner border for depth */}
                  <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10" />
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-background/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.45)_100%)]" />

      {/* Center text — fades out on scroll */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: opacityValue }}
      >
        <div className="relative z-10 mx-4 max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-5 py-2 backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/80">
              Portfolio
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-8xl"
          >
            {'Our '}
            <span className="bg-linear-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Projects
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mx-auto mt-6 max-w-lg text-lg font-light text-foreground/70 sm:text-xl"
          >
            Real transformations. Real families. See how we bring dream homes to life.
          </motion.p>

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mx-auto mt-10 h-px w-32 bg-linear-to-r from-transparent via-foreground/30 to-transparent"
          />
        </div>
      </div>

      {/* Bottom fade into page */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background to-transparent" />
    </section>
  )
}
