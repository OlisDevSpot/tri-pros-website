'use client'

import { motion, useInView } from 'motion/react'
import Link from 'next/link'

import { useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

const PILLAR_COPY = {
  energy: {
    body: 'Federal and state programs are actively funding these upgrades. Caps apply annually \u2014 timing matters.',
    gradient: 'from-blue-600/10 via-teal-500/10 to-blue-600/5',
  },
  luxury: {
    body: 'Exclusive monthly packages with preferred pricing, expedited scheduling, and a written workmanship warranty on every project.',
    gradient: 'from-amber-500/10 via-orange-400/10 to-amber-500/5',
  },
} as const

interface ProgramsTeaserProps {
  pillarType: 'energy' | 'luxury'
}

export function ProgramsTeaser({ pillarType }: ProgramsTeaserProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const config = PILLAR_COPY[pillarType]

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className={cn(
          'rounded-2xl p-8 lg:p-12 text-center bg-linear-to-br',
          config.gradient,
        )}
      >
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-6">
          You May Qualify for Rebates & Incentive Programs
        </h2>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
          {config.body}
        </p>

        <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
          Every family&apos;s situation is different &mdash; we&apos;ll identify what you qualify for during your free consultation.
        </p>

        <Button asChild size="lg" variant="cta">
          <Link href={ROOTS.landing.contact()}>
            Find Out What You Qualify For
          </Link>
        </Button>
      </motion.div>
    </section>
  )
}
