'use client'

import type { FunnelContext, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useMemo } from 'react'
import { PORTFOLIO_BENTO_SPANS, PORTFOLIO_FALLBACK_IMAGES, PORTFOLIO_SLOT_COUNT } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioBlock({ content, ctx }: { content: PortfolioBlockContent, ctx: FunnelContext }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[ctx.slug]

  const tiles = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const hits = projects.filter((p): p is PortfolioProject & { heroImage: NonNullable<PortfolioProject['heroImage']> } =>
      p.heroImage !== null && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
    )
    if (hits.length === 0) {
      console.warn(`[funnels] portfolio block: no projects matched trade ${tradeId} for funnel ${ctx.slug}`)
    }
    const real = hits.map(p => ({ src: getOptimizedSrc(p.heroImage), alt: p.project.title }))
    const padded = [...real]
    for (let i = 0; padded.length < PORTFOLIO_SLOT_COUNT; i++) {
      const fb = PORTFOLIO_FALLBACK_IMAGES[i % PORTFOLIO_FALLBACK_IMAGES.length]
      padded.push({ src: fb.src, alt: fb.alt })
    }
    return padded.slice(0, PORTFOLIO_SLOT_COUNT)
  }, [scopesQ.data, projectsQ.data, tradeId, ctx.slug])

  if (tiles === null) {
    return <div className="bg-muted/40 h-64 w-full animate-pulse rounded-2xl" />
  }

  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      {content.subtitle ? <p className="text-muted-foreground text-center">{content.subtitle}</p> : null}
      <div className="grid auto-rows-[140px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4">
        {tiles.map((tile, i) => (
          <div
            key={`${tile.src}-${i}`}
            className={cn('group relative overflow-hidden rounded-2xl', i === 0 ? 'col-span-2' : '', PORTFOLIO_BENTO_SPANS[i])}
          >
            <Image
              src={tile.src}
              alt={tile.alt}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
