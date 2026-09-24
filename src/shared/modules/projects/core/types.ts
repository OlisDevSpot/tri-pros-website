import type { MediaPhase } from '@/shared/constants/enums/media'
import type { Project, ProjectMediaFile } from '@/shared/db/schema'
import type { projectStoryParts } from '@/shared/modules/projects/core/constants/project-story'
import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'

export interface PublicProject { project: Project, heroImage: ProjectMediaFile | null }

export type ProjectDetail = { project: Project, media: ProjectMediaGroups } | null

export interface ProjectMediaGroups {
  hero: ProjectMediaFile[]
  before: ProjectMediaFile[]
  during: ProjectMediaFile[]
  after: ProjectMediaFile[]
  uncategorized: ProjectMediaFile[]
  videos: ProjectMediaFile[]
  all: ProjectMediaFile[]
}

export interface PortfolioProject {
  project: Project
  heroImage: ProjectMediaFile | null
  scopeIds: string[]
  phaseCounts: MediaPhaseCounts
}

export type PortfolioProjectWithHero = PortfolioProject & { heroImage: ProjectMediaFile }

export interface PortfolioProjectDetail {
  project: Project
  media: ProjectMediaGroups
  scopeIds: string[]
}

export type ProjectStoryPart = (typeof projectStoryParts)[number]

export interface ProjectStoryLine {
  part: ProjectStoryPart
  label: string
  text: string
}

/** A media phase with photos and the parts of the project story told against it. `'hero'` stands in when no media is loaded. */
export interface ProjectStoryPhase {
  phase: MediaPhase | 'hero'
  label: string
  photos: ProjectMediaFile[]
  story: ProjectStoryLine[]
}
