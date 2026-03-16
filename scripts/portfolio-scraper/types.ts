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

export type ImagePhase = 'hero' | 'before' | 'during' | 'after' | 'main'

export interface PhaseClassification {
  filename: string
  phase: ImagePhase
}

export interface CliFlags {
  url: string
  scopesDescription: string
  classify: boolean
  headful: boolean
  verbose: boolean
}
