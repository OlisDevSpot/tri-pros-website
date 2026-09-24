import type { Project } from '@/shared/db/schema'
import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'
import { STORY_PART_PHASE } from '@/shared/modules/projects/core/constants/project-story'

interface StoryStrengthInput {
  project: Pick<Project, 'title'>
  phaseCounts: MediaPhaseCounts
}

function storyPhotoCounts({ phaseCounts }: StoryStrengthInput): number[] {
  return Object.values(STORY_PART_PHASE).map(phase => phaseCounts[phase])
}

/**
 * Stronger story first: more of the story's phases with photos, then more photos across them, then
 * title so the order is stable. Gallery photos carry no part of the story, so they never count.
 */
export function compareStoryStrength(a: StoryStrengthInput, b: StoryStrengthInput): number {
  const countsA = storyPhotoCounts(a)
  const countsB = storyPhotoCounts(b)
  const phasesWithPhotos = (counts: number[]) => counts.filter(n => n > 0).length
  const photos = (counts: number[]) => counts.reduce((sum, n) => sum + n, 0)
  return phasesWithPhotos(countsB) - phasesWithPhotos(countsA)
    || photos(countsB) - photos(countsA)
    || a.project.title.localeCompare(b.project.title)
}
