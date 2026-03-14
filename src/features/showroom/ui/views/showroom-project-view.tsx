'use client'

import type { ShowroomProjectDetail } from '@/shared/entities/projects/types'
import BottomCTA from '@/shared/components/cta'
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
  const { project, media, scopes, trades } = detail
  const heroUrl = media.hero[0]?.url ?? media.main[0]?.url

  return (
    <main>
      <StoryHero project={project} heroUrl={heroUrl} trades={trades} />
      <StoryScopesBar trades={trades} scopes={scopes} />
      <StoryChallenge project={project} mainImage={media.main[0]} />
      <StoryTransformation media={media} />
      <StoryJourney duringPhotos={media.during} />
      <StorySolution project={project} tradesCount={trades.length} scopesCount={scopes.length} />
      <StoryTestimonial project={project} />
      <BottomCTA />
    </main>
  )
}
