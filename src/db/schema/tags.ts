import type z from 'zod'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '@/db/lib/schema-helpers'

export const tags = pgTable('tags', {
  id: unsafeId,
  label: text('label').notNull(),
  accessor: text('accessor').notNull().unique(),
  description: text('description'),
})

export const selectTagSchema = createSelectSchema(tags)
export type Tag = z.infer<typeof selectTagSchema>

export const insertTagSchema = createInsertSchema(tags)
export type InsertTag = z.infer<typeof insertTagSchema>
