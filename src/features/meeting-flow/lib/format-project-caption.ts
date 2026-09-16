import type { ShowcaseProject } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

export function formatProjectCaption(project: Pick<ShowcaseProject, 'city' | 'state' | 'duration'>): string {
  const place = [project.city, project.state].filter(Boolean).join(', ')
  return [SPECIALTIES_COPY.showcase.projectCaptionLead, place, project.duration].filter(Boolean).join(' · ')
}
