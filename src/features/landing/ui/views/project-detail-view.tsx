'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import BottomCTA from '@/shared/components/cta'
import { BeforeAfterGallery } from '../components/portfolio/project/before-after-gallery'
import { ProgressGallery } from '../components/portfolio/project/progress-gallery'
import { ProjectBackstory } from '../components/portfolio/project/project-backstory'
import { ProjectHero } from '../components/portfolio/project/project-hero'
import { ProjectVideosGallery } from '../components/portfolio/project/project-videos-gallery'

interface Props {
  detail: NonNullable<ProjectDetail>
}

export function ProjectDetailView({ detail }: Props) {
  const { project, media } = detail
  const heroUrl = media.hero[0]?.url ?? media.main[0]?.url

  return (
    <main>
      <ProjectHero project={project} heroUrl={heroUrl} />
      <ProjectBackstory project={project} />
      <BeforeAfterGallery media={media} />
      <ProgressGallery media={media} />
      <ProjectVideosGallery media={media} />
      <BottomCTA />
    </main>
  )
}
