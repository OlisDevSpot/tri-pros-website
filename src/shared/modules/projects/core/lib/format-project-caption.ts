import type { Project } from '@/shared/db/schema'

export function formatProjectCaption(project: Pick<Project, 'city' | 'state' | 'projectDuration'>): string {
  const place = [project.city, project.state].filter(Boolean).join(', ')
  return [place, project.projectDuration].filter(Boolean).join(' · ')
}
