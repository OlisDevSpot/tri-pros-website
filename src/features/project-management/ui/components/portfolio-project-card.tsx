'use client'

import type { PortfolioProject } from '@/shared/entities/projects/types'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { AnimatePresence, motion, useInView } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'

interface Props {
  project: PortfolioProject
  index: number
  allScopes: ScopeOrAddon[]
  allTrades: Trade[]
}

export function PortfolioProjectCard({ project: item, index, allScopes, allTrades }: Props) {
  const { project, heroImage, scopeIds } = item

  const trades = useMemo(() => {
    const scopeIdSet = new Set(scopeIds)
    const tradeIdSet = new Set(
      allScopes.filter(s => scopeIdSet.has(s.id)).map(s => s.relatedTrade),
    )
    return allTrades
      .filter(t => tradeIdSet.has(t.id))
      .map(t => ({ id: t.id, name: t.name }))
  }, [scopeIds, allScopes, allTrades])
  const [hovered, setHovered] = useState(false)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
    >
      <Link href={`${ROOTS.landing.portfolioProjects()}/${project.accessor}`}>
        <motion.div
          className="relative overflow-hidden rounded-xl bg-muted aspect-4/3 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.25 }}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
        >
          {heroImage
            ? (
                <OptimizedImage
                  file={heroImage}
                  alt={project.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  priority={index < 3}
                />
              )
            : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/10">
                  <Image
                    src="/company/logo/logo-light.svg"
                    alt="Tri Pros"
                    width={120}
                    height={40}
                    className="opacity-30"
                  />
                </div>
              )}

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-linear-to-t from-background/70 via-background/10 to-transparent" />

          {/* Always-visible info */}
          <div className="absolute bottom-0 left-0 right-0 space-y-1.5 p-4">
            <h3 className="text-lg font-semibold leading-tight text-foreground">{project.title}</h3>
            <p className="text-sm text-foreground/70">
              {project.city}
              {project.state ? `, ${project.state}` : ''}
            </p>
            {trades.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trades.slice(0, 3).map(trade => (
                  <Badge key={trade.id} variant="secondary" className="text-xs bg-foreground/20 text-foreground border-0">
                    {trade.name}
                  </Badge>
                ))}
                {trades.length > 3 && (
                  <Badge variant="secondary" className="text-xs bg-foreground/20 text-foreground border-0">
                    +
                    {trades.length - 3}
                    {' '}
                    more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Hover overlay */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-start justify-center gap-3 bg-background/60 p-5"
              >
                {project.description && (
                  <p className="line-clamp-4 text-sm leading-relaxed text-foreground/90">
                    {project.description}
                  </p>
                )}
                <span className="mt-1 text-sm font-medium text-foreground underline underline-offset-2">
                  View Project →
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.div>
  )
}
