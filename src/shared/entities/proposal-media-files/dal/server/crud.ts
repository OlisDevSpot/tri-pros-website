import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { proposalMediaServerSpec } from '@/shared/entities/proposal-media-files/lib/server-spec'

/**
 * Scoped CRUD handlers for proposal media files. `getById`/`update`/`delete`
 * compose `ctx.scope` — the parent bridge folded in by the child-scoped
 * `proposalMediaProcedure` — so an out-of-scope row is `not-found`, no separate
 * authz probe. Rung by `mediaService` (which wraps R2 + optimize around these);
 * `setVisibility`/`rename` route straight through `update`. Serial int PK.
 */
export const proposalMediaCrud = createCrudDal<typeof proposalMediaServerSpec.table, number>(proposalMediaServerSpec)
