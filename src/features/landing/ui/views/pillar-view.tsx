'use client'

import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'

import { pillarConfigs } from '@/features/landing/constants/pillar-config'
import { BottomCTA } from '@/shared/components/cta'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { ROOTS } from '@/shared/config/roots'
import { ComparisonTable } from '../components/services/comparison-table'
import { NaturalPairings } from '../components/services/natural-pairings'
import { NotionRefreshButton } from '../components/services/notion-refresh-button'
import { ProgramsTeaser } from '../components/services/programs-teaser'
import { ProjectApproach } from '../components/services/project-approach'
import { SwceSection } from '../components/services/swce-section'
import { TradesGrid } from '../components/services/trades-grid'

interface PillarViewProps {
  pillarSlug: PillarSlug
  trades: TradeWithScopes[]
}

export function PillarView({ pillarSlug, trades }: PillarViewProps) {
  const config = pillarConfigs[pillarSlug]
  const pillarType: 'energy' | 'luxury' = pillarSlug === 'energy-efficient-construction' ? 'energy' : 'luxury'

  const pairingsWithPillar = config.pairings.map(p => ({
    ...p,
    pillarSlug,
  }))

  return (
    <div className="h-full w-full">
      {/* Hero Section */}
      <ViewportHero className="bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={config.defaultHeroImage}
            alt={config.title}
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
                {config.title}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-8xl"
            >
              {config.heroHeadline}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="max-w-2xl text-lg font-light text-foreground/70 sm:text-xl"
            >
              {config.heroSubheadline}
            </motion.p>

            {/* Stats — frosted glass pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              {config.stats.map((stat, i) => (
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

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
            >
              <Button asChild size="lg" variant="default" className="h-14 text-lg">
                <Link href={ROOTS.landing.contact()}>Schedule Your Free Consultation</Link>
              </Button>
            </motion.div>
          </div>
        </TopSpacer>
      </ViewportHero>

      <NotionRefreshButton />
      <TradesGrid trades={trades} pillarSlug={pillarSlug} />
      <SwceSection variant="full" />
      <ProjectApproach steps={config.projectApproach} />
      <NaturalPairings pairings={pairingsWithPillar} />
      <ComparisonTable />
      <ProgramsTeaser pillarType={pillarType} />
      <BottomCTA />
    </div>
  )
}
