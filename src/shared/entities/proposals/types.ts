import type z from 'zod'
import type { fundingSectionSchema, homeownerSectionSchema, projectSectionSchema, sowSchema } from './schemas'

export interface SOW extends z.infer<typeof sowSchema> {}

export interface HomeownerSection extends z.infer<typeof homeownerSectionSchema> {}
export interface ProjectSection extends z.infer<typeof projectSectionSchema> {}
export interface FundingSection extends z.infer<typeof fundingSectionSchema> {}
