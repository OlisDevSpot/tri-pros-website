import type { ShowcaseMedia, ShowcaseProject, TradePhoto } from '@/features/meeting-flow/types'
import { formatProjectCaption } from '@/features/meeting-flow/lib/format-project-caption'

export function curatedMedia(photo: TradePhoto): ShowcaseMedia {
  return { key: photo.src, kind: 'curated', photo, caption: photo.alt }
}

export function projectMedia(project: ShowcaseProject): ShowcaseMedia {
  return { key: `project:${project.id}`, kind: 'project', file: project.heroImage, caption: formatProjectCaption(project) }
}
