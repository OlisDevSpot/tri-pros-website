import type z from 'zod'
import type { BeforeAfterPairs } from '@/shared/entities/projects/schemas'
import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { accessor, createdAt, description, id, updatedAt } from '../lib/schema-helpers'
import { mediaFiles } from './media-files'
import { x_projectScopes } from './x-project-scopes'

export const projects = pgTable('projects', {
  id,
  title: varchar('title', { length: 80 }).notNull(),
  accessor: accessor.unique(),
  description,
  backstory: text('backstory'),
  isPublic: boolean('is_public').notNull().default(false),
  address: varchar('address', { length: 255 }),
  city: varchar('city', { length: 80 }).notNull(),
  state: varchar('state', { length: 2 }).default('CA'),
  zip: varchar('zip', { length: 5 }),
  hoRequirements: jsonb('ho_requirements').$type<string[]>(),
  homeownerName: varchar('homeowner_name', { length: 80 }),
  homeownerQuote: text('homeowner_quote'),
  projectDuration: varchar('project_duration', { length: 40 }),
  completedAt: timestamp('completed_at', { mode: 'string', withTimezone: true }),
  challengeDescription: text('challenge_description'),
  solutionDescription: text('solution_description'),
  resultDescription: text('result_description'),
  beforeDescription: text('before_description'),
  duringDescription: text('during_description'),
  afterDescription: text('after_description'),
  mainDescription: text('main_description'),
  beforeAfterPairsJSON: jsonb('before_after_pairs_json').$type<BeforeAfterPairs>(),
  createdAt,
  updatedAt,
})

export const projectsRelations = relations(projects, ({ many }) => ({
  mediaFiles: many(mediaFiles),
  projectScopes: many(x_projectScopes),
}))

export const selectProjectSchema = createSelectSchema(projects)
export type Project = z.infer<typeof selectProjectSchema>

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertProject = z.infer<typeof insertProjectSchema>
