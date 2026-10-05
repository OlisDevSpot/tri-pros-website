import type { Project, ProjectMediaFile } from '@/shared/db/schema'
import type { ProjectMediaGroups, ProjectStoryLine, ProjectStoryPart, ProjectStoryPhase } from '@/shared/modules/projects/core/types'
import { HERO_STORY_PHASE_LABEL, projectStoryParts, STORY_LABELS, STORY_PART_PHASE, STORY_PHASE_ORDER } from '@/shared/modules/projects/core/constants/project-story'
import { PHASE_LABELS } from '@/shared/modules/projects/media/constants/phase-labels'

interface BuildProjectStoryPhasesInput {
  project: Pick<Project, 'challengeDescription' | 'solutionDescription' | 'resultDescription'>
  heroImage: ProjectMediaFile
  media: ProjectMediaGroups | null
}

function storyLines(project: BuildProjectStoryPhasesInput['project']): ProjectStoryLine[] {
  const texts: Record<ProjectStoryPart, string | null> = {
    challenge: project.challengeDescription,
    solution: project.solutionDescription,
    result: project.resultDescription,
  }
  return projectStoryParts
    .map(part => ({ part, label: STORY_LABELS[part], text: texts[part]?.trim() ?? '' }))
    .filter(line => line.text)
}

function heroFirst(photos: ProjectMediaFile[], hero: ProjectMediaFile): ProjectMediaFile[] {
  const match = photos.find(photo => photo.id === hero.id)
  return match ? [match, ...photos.filter(photo => photo !== match)] : photos
}

/**
 * The project story told against the project's photos: one story phase per media phase that has
 * photos, in story order. A part whose own phase has no photos joins the next story phase (or the
 * last one), so no part of the story is dropped with its photos.
 */
export function buildProjectStoryPhases({ project, heroImage, media }: BuildProjectStoryPhasesInput): ProjectStoryPhase[] {
  const lines = storyLines(project)
  const phases: ProjectStoryPhase[] = media
    ? STORY_PHASE_ORDER
        .filter(phase => media[phase].length > 0)
        .map(phase => ({ phase, label: PHASE_LABELS[phase], photos: heroFirst(media[phase], heroImage), story: [] }))
    : []

  if (phases.length === 0) {
    return [{ phase: 'hero', label: HERO_STORY_PHASE_LABEL, photos: [heroImage], story: lines }]
  }

  for (const line of lines) {
    const home = STORY_PHASE_ORDER.indexOf(STORY_PART_PHASE[line.part])
    const target = phases.find(p => p.phase !== 'hero' && STORY_PHASE_ORDER.indexOf(p.phase) >= home) ?? phases.at(-1)!
    target.story.push(line)
  }
  return phases
}
