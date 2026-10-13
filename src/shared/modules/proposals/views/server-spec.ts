import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProposalViewSchema,
  proposalViews,
  selectProposalViewSchema,
} from '@/shared/db/schema/proposal-views'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { PROPOSAL_VIEW } from '@/shared/modules/proposals/views/lib/constants'

// Views are append-only events; nothing patches them. The update schema exists
// only because the spec shape requires one (the engine's `update` slot is never
// exposed by the views service).
const updateProposalViewSchema = insertProposalViewSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const proposalViewSchemas = {
  insert: insertProposalViewSchema,
  update: updateProposalViewSchema,
}

/**
 * `proposal_views` as a first-class CHILD entity. No independent ownership: it
 * is the field `views` of `Proposal`, read and written through the proposal's
 * rules on that field. No lifecycle hooks: a view is an immutable event
 * with nothing to derive.
 */
export const proposalViewServerSpec = defineSubEntitySpec({
  entityName: PROPOSAL_VIEW,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views' },
  table: proposalViews,
  schemas: {
    insert: insertProposalViewSchema,
    update: updateProposalViewSchema,
    select: selectProposalViewSchema,
  },
})
