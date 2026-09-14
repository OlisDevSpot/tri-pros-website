import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertProposalMediaFileSchema,
  proposalMediaFiles,
  selectProposalMediaFileSchema,
} from '@/shared/db/schema/proposal-media-files'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { PROPOSAL_MEDIA_FILE } from '@/shared/modules/proposals/media/lib/constants'

// The insert schema is already heavily `.partial()`d; update simply partials the
// rest so any subset of columns is patchable (e.g. `{ name }`, `{ visibility }`).
const updateProposalMediaFileSchema = insertProposalMediaFileSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const proposalMediaSchemas = {
  insert: insertProposalMediaFileSchema,
  update: updateProposalMediaFileSchema,
}

/**
 * `proposal_media_files` as a first-class CHILD entity. It has no independent
 * ownership, so it declares NO own `visibility` — its effective scope is
 * entirely parent-derived: `resolveEffectiveScope` composes
 * `proposalId IN (SELECT proposals.id WHERE <proposal effective scope>)` and
 * folds it into `ctx.scope`. That single bridged predicate drops into every
 * `createCrudDal` WHERE (getById/update/delete), so scoping a media mutation is
 * ONE query — no per-row authz probe (the N+1 this epic set out to kill).
 *
 * `caslSubject` reuses the parent `Proposal` subject: there are no grants for
 * `ProposalMediaFile`, and "may I touch this proposal's media?" IS "may I update
 * this proposal?" — enforced by the router's capability gate + this row scope.
 *
 * Serial int PK → `TId = number`. No lifecycle `hooks` here: R2 object cleanup
 * and optimize dispatch are ORCHESTRATION and live in `mediaService`, which
 * rings this CRUD DAL (see services/media/media.service.ts).
 */
export const proposalMediaServerSpec = {
  entityName: PROPOSAL_MEDIA_FILE,
  caslSubject: proposalServerSpec.caslSubject,
  parent: { spec: proposalServerSpec, fk: proposalMediaFiles.proposalId },
  table: proposalMediaFiles,
  schemas: {
    insert: insertProposalMediaFileSchema,
    update: updateProposalMediaFileSchema,
    select: selectProposalMediaFileSchema,
  },
} satisfies EntityServerSpec<typeof proposalMediaFiles, number>
