'use client'

import type { FunnelContext, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useMemo } from 'react'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioBlock({ content, ctx }: { content: PortfolioBlockContent, ctx: FunnelContext }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())

  const tradeId = TRADE_BY_SLUG[ctx.slug]

  const matched = useMemo(() => {
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
    return hits.slice(0, content.maxItems ?? 6)
  }, [scopesQ.data, projectsQ.data, tradeId, ctx.slug, content.maxItems])

  if (matched === null) {
    return <div className="bg-muted/40 h-64 w-full animate-pulse rounded-2xl" />
  }
  if (matched.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-center text-2xl font-semibold">{content.title}</h2> : null}
      {content.subtitle ? <p className="text-muted-foreground text-center">{content.subtitle}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matched.map(p => (
          <div key={p.project.id} className="overflow-hidden rounded-xl">
            <Image
              src={getOptimizedSrc(p.heroImage)}
              alt={p.project.title}
              width={400}
              height={300}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
