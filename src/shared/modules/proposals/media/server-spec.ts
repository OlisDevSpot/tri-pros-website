import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
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
 * `proposal_media_files` as a first-class CHILD entity with no independent
 * ownership. It is the field `media` of `Proposal`: there are no grants for
 * `ProposalMediaFile`, and "may I touch this proposal's media?" IS "may I update
 * this proposal's `media`?", which the compiled rules answer in each query's WHERE.
 *
 * The spec itself carries no `hooks` — those live on `createCrudDal`'s config factory in `dal/server/crud.ts`, where
 * `create.after`/`delete.before` fire optimize dispatch and R2 cleanup on every
 * origin (C32, D5), same as the project twin.
 */
export const proposalMediaServerSpec = defineSubEntitySpec({
  entityName: PROPOSAL_MEDIA_FILE,
  parent: { spec: proposalServerSpec, fk: proposalMediaFiles.proposalId, field: 'media' },
  table: proposalMediaFiles,
  schemas: {
    insert: insertProposalMediaFileSchema,
    update: updateProposalMediaFileSchema,
    select: selectProposalMediaFileSchema,
  },
})
