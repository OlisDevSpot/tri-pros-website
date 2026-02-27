import type z from 'zod'
import type { fundingSectionSchema, homeownerSectionSchema, projectSectionSchema } from './schemas'

export interface SOW {
  title: string
  scopes: string[]
  trade: string
  html: string
}

export interface HomeownerSection extends z.infer<typeof homeownerSectionSchema> {}
export interface ProjectSection extends z.infer<typeof projectSectionSchema> {}
export interface FundingSection extends z.infer<typeof fundingSectionSchema> {}
