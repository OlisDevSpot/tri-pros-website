import type z from 'zod'
import { relations } from 'drizzle-orm'
import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { accessor, createdAt, description, unsafeId, updatedAt } from '../lib/schema-helpers'
import { mediaFiles } from './media-files'

export const projects = pgTable('projects', {
  id: unsafeId,
  title: varchar('title', { length: 80 }).notNull(),
  accessor: accessor.unique(),
  description,
  createdAt,
  updatedAt,
})

export const projectsRelations = relations(projects, ({ many }) => ({
  mediaFiles: many(mediaFiles),
}))

export const selectProjectSchema = createSelectSchema(projects)
export type Project = z.infer<typeof selectProjectSchema>

export const insertProjectSchema = selectProjectSchema.omit({ id: true, createdAt: true, updatedAt: true })
export type InsertProject = z.infer<typeof insertProjectSchema>
