import type z from 'zod'
import type { formMetaSectionSchema, fundingSectionSchema, projectSectionSchema, sowSchema } from './schemas'

export interface SOW extends z.infer<typeof sowSchema> {}

export interface FormMetaSection extends z.infer<typeof formMetaSectionSchema> {}
export interface ProjectSection extends z.infer<typeof projectSectionSchema> {}
export interface FundingSection extends z.infer<typeof fundingSectionSchema> {}

/** Aggregated trade + scopes summary (computed from SOW data in queries). */
export interface SowTradeScope {
  trade: string
  scopes: string[]
}
