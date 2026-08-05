import type z from 'zod'
import type { Tag } from '@/shared/constants/tags'
import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '../lib/schema-helpers'
import { baseMediaColumns } from './lib/media-columns'
import { mediaPhaseEnum } from './meta'
import { projects } from './projects'

export const mediaFiles = pgTable('media_files', {
  id: unsafeId,
  ...baseMediaColumns,
  url: varchar('url', { length: 255 }).notNull(),
  tags: jsonb('tags').$type<Tag[]>(),
  isHeroImage: boolean('is_hero_image').notNull().default(false),
  phase: mediaPhaseEnum('phase').notNull().default('uncategorized'),
  thumbnailUrl: varchar('thumbnail_url', { length: 255 }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
})

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
  project: one(projects, {
    fields: [mediaFiles.projectId],
    references: [projects.id],
  }),
}))

export const selectMediaFilesSchema = createSelectSchema(mediaFiles)
export type MediaFile = z.infer<typeof selectMediaFilesSchema>

export const insertMediaFilesSchema = selectMediaFilesSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  tags: true,
  isHeroImage: true,
  sortOrder: true,
  duration: true,
  thumbnailUrl: true,
  bucket: true,
  optimizationStatus: true,
  optimizationVariants: true,
  blurDataUrl: true,
  provider: true,
  externalId: true,
})
export type InsertMediaFilesSchema = z.infer<typeof insertMediaFilesSchema>
