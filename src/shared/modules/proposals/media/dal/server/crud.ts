import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { isOptimizable } from '@/shared/modules/media/core/lib/optimizable'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { PROPOSAL_MEDIA } from '@/shared/modules/proposals/media/lib/constants'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'

/**
 * Scoped CRUD handlers for proposal media files. `getById`/`update`/`delete`
 * compose `ctx.scope` — the parent bridge folded in by the child-scoped
 * `proposalMediaProcedure` — so an out-of-scope row is `not-found`, no separate
 * authz probe. `setVisibility`/`rename` route straight through `update`.
 * Serial int PK.
 *
 * Row lifecycle (optimize dispatch, R2 purge) lives in the hooks below (C32, D5),
 * not in the service — so it fires on every origin. Same inline/pre-commit caveat
 * as the project twin (`modules/projects/media/dal/server/crud.ts`).
 */
export const proposalMediaCrud = createCrudDal(proposalMediaServerSpec, () => ({
  hooks: {
    create: {
      after(row: ProposalMediaFile) {
        if (isOptimizable(row.mimeType)) {
          void optimizeMediaJob.dispatch({ ownerKind: PROPOSAL_MEDIA.ownerKind, mediaId: row.id })
        }
      },
    },
    delete: {
      async before(row: ProposalMediaFile) {
        await purgeMediaObject(row, PROPOSAL_MEDIA.variants)
      },
    },
  },
}))
