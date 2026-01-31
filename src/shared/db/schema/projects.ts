import type z from 'zod'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { accessor, createdAt, description, id, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { mediaFiles } from './media-files'

export const projects = pgTable('projects', {
  id,
  title: varchar('title', { length: 80 }).notNull(),
  accessor: accessor.unique(),
  description,
  address: varchar('address', { length: 255 }),
  city: varchar('city', { length: 80 }).notNull(),
  state: varchar('state', { length: 2 }).default('CA'),
  zip: varchar('zip', { length: 5 }),
  hoRequirements: jsonb('ho_requirements').$type<string[]>(),
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' }),
  createdAt,
  updatedAt,
})

export const projectsRelations = relations(projects, ({ many }) => ({
  mediaFiles: many(mediaFiles),
}))

export const selectProjectSchema = createSelectSchema(projects)
export type Project = z.infer<typeof selectProjectSchema>

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertProject = z.infer<typeof insertProjectSchema>
