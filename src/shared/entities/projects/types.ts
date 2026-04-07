import type { MediaFile, Project } from '@/shared/db/schema'

export interface PublicProject { project: Project, heroImage: MediaFile | null }

export type ProjectDetail = { project: Project, media: ProjectMediaGroups } | null

export interface ProjectMediaGroups {
  hero: MediaFile[]
  before: MediaFile[]
  during: MediaFile[]
  after: MediaFile[]
  uncategorized: MediaFile[]
  videos: MediaFile[]
  all: MediaFile[]
}

export interface PortfolioProject {
  project: Project
  heroImage: MediaFile | null
  scopeIds: string[]
}

export interface PortfolioProjectDetail {
  project: Project
  media: ProjectMediaGroups
  scopeIds: string[]
}
