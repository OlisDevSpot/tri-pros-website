'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'

import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

const HERO_STATS = [
  { value: `${companyInfo.numProjects}+`, label: 'Projects' },
  { value: `$${companyInfo.valueOfProjectsInDollars / 1_000_000}M+`, label: 'Completed' },
  { value: `${Math.round(companyInfo.clientSatisfaction * 100)}%`, label: 'Satisfaction' },
  { value: `${companyInfo.generations}`, label: 'Generations' },
]

export function ServicesOverviewHero() {
  return (
    <ViewportHero className="bg-background">
      {/* Background image with cinematic overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="/hero-photos/modern-house-5.jpg"
          alt="Southern California home transformed by Tri Pros Remodeling"
          fill
          className="object-cover"
          priority
        />
      </motion.div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 z-1 bg-background/45" />
      <div className="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.5)_100%)]" />

      <TopSpacer>
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-5 py-2 backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/80">
              Our Services
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-8xl"
          >
            Your Home. Done Right.
            {' '}
            <span className="bg-linear-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Backed Forever.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="max-w-2xl text-lg font-light text-foreground/70 sm:text-xl"
          >
            Licensed. Insured. Warranted.
            {' '}
            {companyInfo.numProjects}
            + Southern California homes transformed.
          </motion.p>

          {/* Stats strip — frosted glass pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {HERO_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.8 + i * 0.08 }}
                className="rounded-full border border-foreground/15 bg-foreground/5 px-5 py-2.5 backdrop-blur-md"
              >
                <span className="text-lg font-bold text-foreground">{stat.value}</span>
                <span className="ml-1.5 text-sm text-foreground/60">{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="h-px w-32 bg-linear-to-r from-transparent via-foreground/30 to-transparent"
          />

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Button asChild size="lg" variant="default" className="h-14 text-lg">
              <Link href={ROOTS.landing.contact()}>Schedule Your Free Consultation</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 border-foreground/20 bg-foreground/5 text-lg text-foreground backdrop-blur-md hover:bg-foreground/10 hover:text-foreground"
            >
              <Link href={ROOTS.landing.portfolioProjects()}>See Our Work</Link>
            </Button>
          </motion.div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
