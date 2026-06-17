'use client'

import { ArrowRight, BadgeCheck, ShieldCheck } from 'lucide-react'
import millify from 'millify'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const STAT_TRANSITION = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }

export function AboutHero() {
  const portraitRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: portraitRef,
    offset: ['start end', 'end start'],
  })

  const portraitY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? ['0%', '0%'] : ['-6%', '6%'])

  return (
    <ViewportHero>
      <TopSpacer>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-16 lg:gap-20 items-center">
            {/* Content */}
            <motion.div
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.08 }}
              className="space-y-8"
            >
              <motion.span
                variants={FADE_UP}
                transition={STAT_TRANSITION}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-secondary font-semibold"
              >
                <span className="h-px w-8 bg-secondary/70" aria-hidden />
                Our Story
              </motion.span>

              <motion.h1
                variants={FADE_UP}
                transition={STAT_TRANSITION}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight"
              >
                A Company Built on Values, Ethics, and
                {' '}
                <span className="text-secondary">Master Craftsmanship</span>
              </motion.h1>

              <motion.p
                variants={FADE_UP}
                transition={STAT_TRANSITION}
                className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl"
              >
                Founded in
                {' '}
                {companyInfo.yearFounded}
                {' '}
                by Sean Phil, Tri Pros Remodeling is built on a foundation of
                unwavering commitment to quality, honest communication, and the
                kind of follow-through that turns a remodel into a relationship.
              </motion.p>

              {/* Architectural stat strip */}
              <motion.div
                variants={FADE_UP}
                transition={STAT_TRANSITION}
                className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 py-5"
              >
                <Stat label="Founded" value={String(companyInfo.yearFounded)} />
                <Stat
                  label="Projects Value"
                  value={`$${millify(companyInfo.valueOfProjectsInDollars)}+`}
                />
                <Stat
                  label="Generations"
                  value={String(companyInfo.generations)}
                />
              </motion.div>

              {/* CTAs — stack on mobile, side-by-side from sm up */}
              <motion.div
                variants={FADE_UP}
                transition={STAT_TRANSITION}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2"
              >
                <Button
                  asChild
                  size="lg"
                  variant="default"
                  className="group h-14 px-7 text-base font-semibold motion-safe:transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  <Link href={ROOTS.landing.contact()}>
                    Meet Our Team
                    <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 px-7 text-base font-semibold"
                >
                  <Link href={ROOTS.landing.portfolioProjects()}>
                    View Our Legacy
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Portrait + badge stack */}
            <motion.div
              ref={portraitRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="relative aspect-4/5 lg:aspect-auto lg:h-144 xl:h-160"
            >
              {/* Architectural offset frame */}
              <div className="absolute -inset-3 sm:-inset-4 border border-secondary/40 rounded-2xl hidden sm:block" aria-hidden />

              <motion.div
                style={{ y: portraitY }}
                className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
              >
                <Image
                  src="/hero-photos/modern-house-2.png"
                  alt="Tri Pros Remodeling founder and team"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-linear-to-t from-background/30 via-background/0 to-background/0" aria-hidden />
              </motion.div>

              {/* Floating combined credentials card — top right */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-4 right-4 sm:-top-4 sm:-right-4 bg-card/95 supports-backdrop-filter:bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3"
              >
                <span className="inline-flex items-center justify-center size-9 rounded-lg bg-secondary/15 text-secondary">
                  <ShieldCheck className="size-5" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">BBB</p>
                  <p className="text-base font-bold tabular-nums">A+ Rated</p>
                </div>
              </motion.div>

              {/* Floating projects count card — bottom left */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-4 left-4 sm:-bottom-4 sm:-left-4 bg-card/95 supports-backdrop-filter:bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3"
              >
                <span className="inline-flex items-center justify-center size-9 rounded-lg bg-primary/15 text-primary">
                  <BadgeCheck className="size-5" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="text-2xl font-bold tabular-nums">
                    {companyInfo.numProjects}
                    +
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Projects Built
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0 text-center sm:text-left">
      <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mt-1">
        {label}
      </p>
    </div>
  )
}
