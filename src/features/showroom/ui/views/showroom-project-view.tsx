'use client'

import type { ShowroomProjectDetail } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { StoryChallenge } from '@/features/showroom/ui/components/story-challenge'
import { StoryGallery } from '@/features/showroom/ui/components/story-gallery'
import { StoryHero } from '@/features/showroom/ui/components/story-hero'
import { StorySolution } from '@/features/showroom/ui/components/story-solution'
import { StoryTestimonial } from '@/features/showroom/ui/components/story-testimonial'
import { StoryTimeline } from '@/features/showroom/ui/components/story-timeline'
import { BottomCTA } from '@/shared/components/cta'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  detail: ShowroomProjectDetail
}

export function ShowroomProjectView({ detail }: Props) {
  const trpc = useTRPC()
  const { project, media, scopeIds } = detail
  const heroUrl = media.hero[0]?.url ?? media.uncategorized[0]?.url

  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())

  const tradesWithScopes = useMemo(() => {
    const scopeIdSet = new Set(scopeIds)
    const matchedScopes = allScopes.filter(s => scopeIdSet.has(s.id))

    // Group scopes by their related trade
    const tradeMap = new Map<string, { id: string, name: string }[]>()
    for (const scope of matchedScopes) {
      if (!tradeMap.has(scope.relatedTrade)) {
        tradeMap.set(scope.relatedTrade, [])
      }
      tradeMap.get(scope.relatedTrade)!.push({ id: scope.id, name: scope.name })
    }

    // Resolve trade names and build grouped structure
    return allTrades
      .filter(t => tradeMap.has(t.id))
      .map(t => ({
        trade: { id: t.id, name: t.name },
        scopes: tradeMap.get(t.id) ?? [],
      }))
  }, [scopeIds, allScopes, allTrades])

  const hasTimelinePhotos = media.before.length > 0 || media.during.length > 0 || media.after.length > 0

  return (
    <main>
      <StoryHero project={project} heroUrl={heroUrl} tradesWithScopes={tradesWithScopes} />
      <StoryChallenge project={project} mainImage={media.uncategorized[0]} />
      {hasTimelinePhotos && <StoryTimeline project={project} media={media} />}
      <StorySolution project={project} tradesWithScopes={tradesWithScopes} />
      <StoryGallery media={media} />
      <StoryTestimonial project={project} />
      <BottomCTA />
    </main>
  )
}
