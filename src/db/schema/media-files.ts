import type z from 'zod'
import type { Tag } from '@/constants/tags'
import { jsonb, pgTable, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { createdAt, unsafeId, updatedAt } from '../lib/schema-helpers'

export const mediaFiles = pgTable('media_files', {
  id: unsafeId,
  name: varchar('name', { length: 80 }).notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  tags: jsonb('tags').$type<Tag[]>(),
  createdAt,
  updatedAt,
})

export const selectMediaFilesSchema = createSelectSchema(mediaFiles)
export type SelectMediaFilesSchema = z.infer<typeof selectMediaFilesSchema>

export const insertMediaFilesSchema = selectMediaFilesSchema.omit({ id: true, createdAt: true, updatedAt: true })
export type InsertMediaFilesSchema = z.infer<typeof insertMediaFilesSchema>
