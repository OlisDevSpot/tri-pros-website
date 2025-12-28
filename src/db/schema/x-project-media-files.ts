import { integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { mediaFiles } from './media-files'
import { projects } from './projects'

export const x_projectMediaFiles = pgTable('x_project_media_files', {
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  mediaFileId: integer('media_file_id')
    .notNull()
    .references(() => mediaFiles.id, { onDelete: 'cascade' }),
}, table => ({
  pk: primaryKey({ columns: [table.projectId, table.mediaFileId] }),
}))
