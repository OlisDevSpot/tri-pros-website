'use client'

import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Link from 'next/link'

import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface PairingItem {
  trade1Name?: string
  trade1Slug?: string
  trade2Name?: string
  trade2Slug?: string
  pairedTradeName?: string
  pairedTradeSlug?: string
  pillarSlug: string
  story: string
}

interface NaturalPairingsProps {
  pairings?: PairingItem[]
}

export function NaturalPairings({ pairings }: NaturalPairingsProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  if (!pairings || pairings.length === 0) {
    return null
  }

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          Projects That Work Better Together
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pairings.slice(0, 3).map((pairing, index) => {
          const isPillarLevel = Boolean(pairing.trade1Name && pairing.trade2Name)
          const displayName = isPillarLevel
            ? `${pairing.trade1Name} + ${pairing.trade2Name}`
            : pairing.pairedTradeName ?? ''

          return (
            <motion.div
              key={`${pairing.pillarSlug}-${pairing.trade1Slug ?? pairing.pairedTradeSlug ?? index}`}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{displayName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pairing.story}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isPillarLevel
                      ? (
                          <>
                            {pairing.trade1Slug && (
                              <Link
                                href={`/services/${pairing.pillarSlug}/${pairing.trade1Slug}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                              >
                                {pairing.trade1Name}
                                <ArrowRight className="size-3" />
                              </Link>
                            )}
                            {pairing.trade2Slug && (
                              <Link
                                href={`/services/${pairing.pillarSlug}/${pairing.trade2Slug}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                              >
                                {pairing.trade2Name}
                                <ArrowRight className="size-3" />
                              </Link>
                            )}
                          </>
                        )
                      : (
                          pairing.pairedTradeSlug && (
                            <Link
                              href={`/services/${pairing.pillarSlug}/${pairing.pairedTradeSlug}`}
                              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                              {pairing.pairedTradeName}
                              <ArrowRight className="size-3" />
                            </Link>
                          )
                        )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
