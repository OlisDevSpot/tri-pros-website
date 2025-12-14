import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core'

export const xProjectMediaFiles = pgTable('x_project_media_files', {
  projectId: integer('project_id').notNull(),
  mediaFileId: integer('media_file_id').notNull(),
}, table => ({
  pk: primaryKey({ columns: [table.projectId, table.mediaFileId] }),
}))
