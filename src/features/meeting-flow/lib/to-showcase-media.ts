import type { ShowcaseMedia, ShowcaseProject, TradePhoto } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatProjectCaption } from '@/shared/modules/projects/core/lib/format-project-caption'

export function curatedMedia(photo: TradePhoto): ShowcaseMedia {
  return { key: photo.src, kind: 'curated', photo, caption: photo.alt }
}

export function projectMedia(project: ShowcaseProject): ShowcaseMedia {
  const caption = [SPECIALTIES_COPY.showcase.projectCaptionLead, formatProjectCaption(project)].filter(Boolean).join(' · ')
  return { key: `project:${project.id}`, kind: 'project', file: project.heroImage, caption }
}
