import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { isOwnedObject } from '@/shared/modules/media/core/lib/is-owned-object'
import { isOptimizable } from '@/shared/modules/media/core/lib/optimizable'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'

/**
 * CRUD handlers for proposal media files: an unreachable row is `not-found`, no
 * separate authz probe. Serial int PK.
 *
 * Row lifecycle (optimize dispatch, R2 purge) lives in the hooks below,
 * not in the service — so it fires on every origin. Same inline/pre-commit caveat
 * as the project twin (`modules/projects/media/dal/server/crud.ts`).
 *
 * ORDERING, considered and kept: `delete.before` purges R2 BEFORE the engine's
 * DELETE, so a failed DELETE leaves the row pointing at objects that are gone —
 * exactly the old `mediaService.removeRecord` ordering, so not a regression, and
 * the safer failure mode (a dangling row is visible and re-deletable; orphaned R2
 * objects with no row are not). Revisit only with afterCommit (sub-plan C).
 *
 * ⚠️ `duplicate` ALSO fires `create.after` (`duplicateImpl` routes through
 * `createImpl`), and a duplicated media row copies `pathKey`/`bucket` verbatim —
 * the dispatch would re-optimize the SOURCE object and either copy's
 * `delete.before` would purge the object both rows share. Unreachable today (no
 * `duplicate` procedure on the media routers); give media a real copy-the-object
 * path before exposing one.
 */
export const proposalMediaCrud = createCrudDal(proposalMediaServerSpec, () => ({
  hooks: {
    create: {
      // Deleting the row deletes the object it names; see isOwnedObject.
      before(input) {
        if (!isOwnedObject(input, { bucket: PROPOSAL_MEDIA.bucket, pathKeyPrefix: PROPOSAL_MEDIA.pathKeyPrefix(input.proposalId) })) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return input
      },
      after(row: ProposalMediaFile) {
        if (isOptimizable(row.mimeType)) {
          void optimizeMediaJob.dispatch({ ownerKind: PROPOSAL_MEDIA.ownerKind, mediaId: row.id })
        }
      },
    },
    update: {
      // An object is chosen once, at upload; nothing re-points a row afterwards.
      before(data) {
        if (data.bucket !== undefined || data.pathKey !== undefined) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return data
      },
    },
    delete: {
      async before(row: ProposalMediaFile) {
        await purgeMediaObject(row, PROPOSAL_MEDIA.variants)
      },
    },
  },
}))
