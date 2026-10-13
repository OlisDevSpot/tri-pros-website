import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProjectMediaFilesSchema,
  projectMediaFiles,
  selectProjectMediaFilesSchema,
} from '@/shared/db/schema/project-media-files'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { PROJECT_MEDIA_FILE } from '@/shared/modules/projects/media/lib/constants'

// The insert schema already `.partial()`s the server-derived/defaulted columns;
// update partials the rest so any subset is patchable (e.g. `{ name }`, `{ phase }`).
const updateProjectMediaFileSchema = insertProjectMediaFilesSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const projectMediaSchemas = {
  insert: insertProjectMediaFilesSchema,
  update: updateProjectMediaFileSchema,
}

/** `media_files` (project media): the field `media` of `Project`. Reading it needs the project's read reach; writing it, the project's `update` of `media`. Its hooks live on `createCrudDal` in `dal/server/crud.ts`. */
export const projectMediaServerSpec = defineSubEntitySpec({
  entityName: PROJECT_MEDIA_FILE,
  parent: { spec: projectServerSpec, fk: projectMediaFiles.projectId, field: 'media' },
  table: projectMediaFiles,
  schemas: {
    insert: insertProjectMediaFilesSchema,
    update: updateProjectMediaFileSchema,
    select: selectProjectMediaFilesSchema,
  },
})
