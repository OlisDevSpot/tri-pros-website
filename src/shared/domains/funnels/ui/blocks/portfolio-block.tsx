'use client'

import type { FunnelContext, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useMemo } from 'react'
import { PORTFOLIO_BENTO_SPANS, PORTFOLIO_FALLBACK_IMAGES, PORTFOLIO_SLOT_COUNT } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { Block } from '@/shared/domains/funnels/ui/block/block'
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
    return <div className="bg-muted/40 h-64 w-full animate-pulse rounded-md" />
  }

  return (
    <Block surface="plain" align="center">
      <Block.Content>
        {content.title ? <Block.Headline>{content.title}</Block.Headline> : null}
        {content.subtitle ? <Block.Body>{content.subtitle}</Block.Body> : null}
        <div className="grid w-full auto-rows-[140px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4">
          {tiles.map((tile, i) => (
            <div
              key={`${tile.src}-${i}`}
              className={cn('group relative overflow-hidden rounded-md', i === 0 ? 'col-span-2' : '', PORTFOLIO_BENTO_SPANS[i])}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes={i === 0 ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 50vw, 25vw'}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </Block.Content>
    </Block>
  )
}
