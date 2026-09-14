import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'

/**
 * Scoped CRUD handlers for project media files. Composes `ctx.scope` into
 * getById/update/delete WHERE clauses. Rung by `mediaService` (R2 + optimize
 * wrap these). See `../../lib/server-spec.ts` — the project-media router still
 * passes an unscoped `ctx` today, so these run unscoped until the bridge is
 * turned on in the deferred scoping slice. Serial int PK.
 */
export const mediaFileCrud = createCrudDal(mediaFileServerSpec)
