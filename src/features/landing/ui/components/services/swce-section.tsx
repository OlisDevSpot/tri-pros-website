'use client'

import { Award, Hammer, Shield, TrendingUp } from 'lucide-react'
import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

const SWCE_CARDS = [
  {
    icon: Shield,
    headline: 'You\'re Protected',
    description:
      'Licensed, bonded, and carrying $2M in general liability insurance. Your home and investment are fully covered from day one.',
  },
  {
    icon: Award,
    headline: 'We Stand Behind It',
    description:
      'Every project comes with a written workmanship warranty. If something isn\'t right, we come back and make it right — no questions asked.',
  },
  {
    icon: Hammer,
    headline: 'Done Right the First Time',
    description:
      'Certified installers, manufacturer-approved methods, and inspections at every stage. Craftsmanship you can see and feel.',
  },
  {
    icon: TrendingUp,
    headline: '520+ Projects. Zero Shortcuts.',
    description:
      'Over 15 years and 520+ completed projects across Southern California. Our reputation is built on results, not promises.',
  },
] as const

const COMPACT_BADGES = [
  'Licensed & Bonded',
  '$2M Insured',
  'Written Warranty',
  '15+ Years Experience',
] as const

interface SwceSectionProps {
  variant: 'full' | 'compact'
}

export function SwceSection({ variant }: SwceSectionProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  if (variant === 'compact') {
    return (
      <div ref={ref} className="w-full py-6">
        <div className="flex flex-wrap justify-center gap-3 sm:gap-0 sm:flex-nowrap sm:divide-x sm:divide-border">
          {COMPACT_BADGES.map((badge, index) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="px-4 py-2 text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              {badge}
            </motion.span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          The Tri Pros Difference
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Security, warranty, craftsmanship, and experience — the four pillars that protect every project we take on.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {SWCE_CARDS.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.headline}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <Card className={cn('h-full text-center')}>
                <CardHeader className="items-center pb-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{card.headline}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
