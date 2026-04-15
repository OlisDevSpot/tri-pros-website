import type { MediaPhase } from '@/shared/constants/enums/media'

export interface ScrapedImage {
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface PageMetadata {
  title?: string
  description?: string
  bodyText?: string
}

export interface ScrapeResult {
  images: ScrapedImage[]
  metadata: PageMetadata
  /** Browser session cookies (for authenticated downloads) */
  cookies?: string
}

export interface ProjectContentOutput {
  description: string
  backstory: string
  challengeDescription: string
  solutionDescription: string
  resultDescription: string
  homeownerQuote: string
}

export interface MatchedScope {
  id: string
  name: string
  entryType: string
}

export interface ProjectPromptAnswers {
  title: string
  accessor: string
  city: string
  state: string
  homeownerName: string | null
  projectDuration: string | null
  selectedScopes: MatchedScope[]
  generateAi: boolean
  classifyImages: boolean
}

export type ImagePhase = 'hero' | MediaPhase

export interface PhaseClassification {
  filename: string
  phase: ImagePhase
}

export interface PagesConfig {
  /** Query parameter name (e.g. "page") */
  param: string
  /** Page numbers to scrape */
  pageNumbers: number[]
}

export interface MultiProjectGroup {
  /** Group heading extracted from the DOM */
  heading: string
  /** Images belonging to this group */
  images: ScrapedImage[]
}

export interface MultiProjectResult {
  groups: MultiProjectGroup[]
  metadata: PageMetadata
  /** Browser session cookies (for authenticated downloads) */
  cookies?: string
}

export interface CliFlags {
  url: string
  scopesDescription: string
  classify: boolean
  headful: boolean
  verbose: boolean
  /** Paginated single project — scrape multiple ?param=N URLs and merge images */
  pages: PagesConfig | null
  /** Multi-project page — extract grouped sections from a single URL */
  multiProject: string | null // CSS selector or 'auto'
  /** Explicit site-specific scraper name (e.g. "homeadvisor") — overrides auto-detection */
  source: string | null
  /** Max items to scrape from site-specific scrapers (0 = no limit) */
  limit: number
}
