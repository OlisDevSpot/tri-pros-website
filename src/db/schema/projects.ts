import type z from 'zod'
import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { accessor, createdAt, description, unsafeId, updatedAt } from '../lib/schema-helpers'

export const projects = pgTable('projects', {
  id: unsafeId,
  title: varchar('title', { length: 80 }).notNull(),
  accessor: accessor.unique(),
  heroImage: varchar('image_url', { length: 255 }).notNull(),
  description,
  createdAt,
  updatedAt,
})

export const selectProjectSchema = createSelectSchema(projects)
export type Project = z.infer<typeof selectProjectSchema>

export const insertProjectSchema = selectProjectSchema.omit({ id: true, createdAt: true, updatedAt: true })
export type InsertProject = z.infer<typeof insertProjectSchema>
