import type z from 'zod'
import type { Tag } from '@/shared/constants/tags'
import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { createdAt, unsafeId, updatedAt } from '../lib/schema-helpers'
import { projects } from './projects'

export const mediaFiles = pgTable('media_files', {
  id: unsafeId,
  name: varchar('name', { length: 80 }).notNull(),
  pathKey: text('path_key').notNull().unique(),
  bucket: text('bucket').notNull(),
  mimeType: text('mime_type').notNull(),
  fileExtension: text('file_extension').notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  tags: jsonb('tags').$type<Tag[]>(),
  isHeroImage: boolean('is_hero_image').notNull().default(false),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdAt,
  updatedAt,
})

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
  project: one(projects, {
    fields: [mediaFiles.projectId],
    references: [projects.id],
  }),
}))

export const selectMediaFilesSchema = createSelectSchema(mediaFiles)
export type SelectMediaFilesSchema = z.infer<typeof selectMediaFilesSchema>

export const insertMediaFilesSchema = selectMediaFilesSchema.omit({ id: true, createdAt: true, updatedAt: true })
export type InsertMediaFilesSchema = z.infer<typeof insertMediaFilesSchema>
