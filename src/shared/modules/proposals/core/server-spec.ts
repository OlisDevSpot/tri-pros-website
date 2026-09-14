import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { proposalVisibility } from '@/shared/modules/proposals/core/lib/visibility'

// `kind` is server-derived (omitted from insert schema), so update inherits the exclusion.
const updateProposalSchema = insertProposalSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: updateProposalSchema,
}

// Lifecycle hooks (kind/token/SOW-snapshot on create, lock ladder + financial
// recompute on update) and the `duplicate` config live in the config factory in
// ../dal/server/crud.ts — NOT on this spec. `shareable` stays here (spec-level
// token-scope config consumed by the shareable middleware).
export const proposalServerSpec = {
  entityName: PROPOSAL,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposals,
  schemas: {
    insert: insertProposalSchema,
    update: updateProposalSchema,
    select: selectProposalSchema,
  },
  shareable: { tokenColumn: 'token' },
} satisfies EntityServerSpec<typeof proposals>
