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
    <ViewportHero>
      {/* Background Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-0"
      >
        <Image
          src="/hero-photos/modern-house-5.jpg"
          alt="Southern California home transformed by Tri Pros Remodeling"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/80 to-background/50" />
      </motion.div>

      <TopSpacer>
        <div className="h-full relative container flex flex-col gap-8 z-10 justify-center">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="font-bold leading-tight">
              Your Home. Done Right.
              {' '}
              <span className="text-[color-mix(in_oklch,var(--primary)_80%,var(--foreground)_10%)]">
                Backed Forever.
              </span>
            </h1>
          </motion.div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl leading-relaxed max-w-2xl"
          >
            {`Licensed. Insured. Warranted. ${companyInfo.numProjects}+ Southern California homes transformed.`}
          </motion.p>

          {/* Stats Strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl"
          >
            {HERO_STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                className="text-center py-4 border bg-background/70 rounded-sm border-border/50 shadow-xl"
              >
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="flex flex-col sm:flex-row gap-4 max-w-lg"
          >
            <Button
              asChild
              size="lg"
              variant="default"
              className="text-lg h-14 flex-1"
            >
              <Link href={ROOTS.landing.contact()}>Schedule Your Free Consultation</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-lg h-14 flex-1"
            >
              <Link href={ROOTS.landing.portfolioProjects()}>See Our Work</Link>
            </Button>
          </motion.div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
