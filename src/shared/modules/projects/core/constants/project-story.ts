import type { MediaPhase } from '@/shared/constants/enums/media'
import type { ProjectStoryPart } from '@/shared/modules/projects/core/types'

/** Story order: the challenge comes before the solution, which comes before the result. */
export const projectStoryParts = ['challenge', 'solution', 'result'] as const

/** The order a project is told in. Gallery comes last: it carries no part of the story. */
export const STORY_PHASE_ORDER = ['before', 'during', 'after', 'uncategorized'] as const satisfies readonly MediaPhase[]

/** Where each part of the story belongs: the challenge is what the before photos show, and so on. */
export const STORY_PART_PHASE: Record<ProjectStoryPart, MediaPhase> = {
  challenge: 'before',
  solution: 'during',
  result: 'after',
}

export const STORY_LABELS: Record<ProjectStoryPart, string> = {
  challenge: 'Challenge',
  solution: 'Solution',
  result: 'Result',
}

export const HERO_STORY_PHASE_LABEL = 'The project'
