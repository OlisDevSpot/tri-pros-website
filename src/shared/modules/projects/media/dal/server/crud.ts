import type { ProjectMediaFile } from '@/shared/db/schema/project-media-files'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { isOptimizable } from '@/shared/modules/media/core/lib/optimizable'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { PROJECT_MEDIA } from '@/shared/modules/projects/media/lib/constants'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'

/**
 * Scoped CRUD handlers for project media files, with the row lifecycle attached
 * (C32, D5): optimize-on-create and purge-on-delete are entity-invariant, so they
 * are factory hooks here rather than wrappers in a service — they fire on every
 * call and every origin, including a bare `projectMediaCrud.create` from a script.
 *
 * HOOK CAVEAT (same as entities/meetings/dal/server/crud.ts): these run INLINE.
 * On the naked path the write autocommits before the hook fires. If a future
 * orchestrator threads a tx in via `withTx`, the dispatch fires PRE-COMMIT and
 * won't roll back; `afterCommit` (sub-plan C) is deferred.
 *
 * The hooks read PROJECT_MEDIA (a leaf constants module), never the store — the
 * store imports this file, and going the other way would add a second edge to the
 * cycle D6 already has to defuse.
 *
 * See ../../server-spec.ts: the project-media router still passes an unscoped ctx,
 * so these run unscoped there until #285 turns the parent bridge on. Serial int PK.
 */
export const projectMediaCrud = createCrudDal(projectMediaServerSpec, () => ({
  hooks: {
    create: {
      after(row: ProjectMediaFile) {
        if (isOptimizable(row.mimeType)) {
          void optimizeMediaJob.dispatch({ ownerKind: PROJECT_MEDIA.ownerKind, mediaId: row.id })
        }
      },
    },
    delete: {
      async before(row: ProjectMediaFile) {
        await purgeMediaObject(row, PROJECT_MEDIA.variants)
      },
    },
  },
}))
