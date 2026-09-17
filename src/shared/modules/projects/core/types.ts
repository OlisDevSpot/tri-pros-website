import type { Project, ProjectMediaFile } from '@/shared/db/schema'

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
}

export interface PortfolioProjectDetail {
  project: Project
  media: ProjectMediaGroups
  scopeIds: string[]
}
