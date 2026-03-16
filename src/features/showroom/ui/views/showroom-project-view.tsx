'use client'

import type { ShowroomProjectDetail } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import BottomCTA from '@/shared/components/cta'
import { useTRPC } from '@/trpc/helpers'
import { StoryChallenge } from '../components/story-challenge'
import { StoryHero } from '../components/story-hero'
import { StoryJourney } from '../components/story-journey'
import { StoryScopesBar } from '../components/story-scopes-bar'
import { StorySolution } from '../components/story-solution'
import { StoryTestimonial } from '../components/story-testimonial'
import { StoryTransformation } from '../components/story-transformation'

interface Props {
  detail: ShowroomProjectDetail
}

export function ShowroomProjectView({ detail }: Props) {
  const trpc = useTRPC()
  const { project, media, scopeIds } = detail
  const heroUrl = media.hero[0]?.url ?? media.main[0]?.url

  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())

  const { resolvedScopes, resolvedTrades } = useMemo(() => {
    const scopeIdSet = new Set(scopeIds)
    const matchedScopes = allScopes
      .filter(s => scopeIdSet.has(s.id))
      .map(s => ({ id: s.id, name: s.name }))

    const tradeIdSet = new Set(
      allScopes.filter(s => scopeIdSet.has(s.id)).map(s => s.relatedTrade),
    )
    const matchedTrades = allTrades
      .filter(t => tradeIdSet.has(t.id))
      .map(t => ({ id: t.id, name: t.name }))

    return { resolvedScopes: matchedScopes, resolvedTrades: matchedTrades }
  }, [scopeIds, allScopes, allTrades])

  return (
    <main>
      <StoryHero project={project} heroUrl={heroUrl} trades={resolvedTrades} />
      <StoryScopesBar trades={resolvedTrades} scopes={resolvedScopes} />
      <StoryChallenge project={project} mainImage={media.main[0]} />
      <StoryTransformation media={media} />
      <StoryJourney duringPhotos={media.during} />
      <StorySolution project={project} tradesCount={resolvedTrades.length} scopesCount={resolvedScopes.length} />
      <StoryTestimonial project={project} />
      <BottomCTA />
    </main>
  )
}
