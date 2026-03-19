'use client'

import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'

import { pillarConfigs } from '@/features/landing/constants/pillar-config'
import { BottomCTA } from '@/shared/components/cta'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Badge } from '@/shared/components/ui/badge'
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
      <ViewportHero>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={config.defaultHeroImage}
            alt={config.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-r from-background/80 to-background/50" />
        </motion.div>

        <TopSpacer>
          <div className="h-full relative container flex flex-col gap-8 z-10 justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="font-bold leading-tight">
                {config.heroHeadline}
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl leading-relaxed max-w-2xl"
            >
              {config.heroSubheadline}
            </motion.p>

            {/* Stats Strip */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-wrap gap-4 max-w-2xl"
            >
              {config.stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                >
                  <Badge variant="secondary" className="px-4 py-2 text-base font-medium">
                    <span className="font-bold mr-1.5">{stat.value}</span>
                    {stat.label}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <Button
                asChild
                size="lg"
                variant="default"
                className="text-lg h-14"
              >
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
