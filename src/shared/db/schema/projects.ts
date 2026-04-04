import type z from 'zod'
import type { BeforeAfterPairs } from '@/shared/entities/projects/schemas'
import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { accessor, createdAt, description, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { mediaFiles } from './media-files'
import { meetings } from './meetings'
import { projectStatusEnum } from './meta'
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
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  status: projectStatusEnum('status').notNull().default('active'),
  pipelineStage: text('pipeline_stage'),
  startedAt: timestamp('started_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
})

export const projectsRelations = relations(projects, ({ many, one }) => ({
  customer: one(customers, {
    fields: [projects.customerId],
    references: [customers.id],
  }),
  owner: one(user, {
    fields: [projects.ownerId],
    references: [user.id],
  }),
  meetings: many(meetings),
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
