import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'

// Staff write any column the rules allow; a share link's rules name its few columns.
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
export const proposalServerSpec = defineEntitySpec({
  entityName: PROPOSAL,
  subject: PROPOSAL,
  conditionColumns: ['id'],
  table: proposals,
  schemas: {
    insert: insertProposalSchema,
    update: updateProposalSchema,
    select: selectProposalSchema,
  },
  shareable: { tokenColumn: 'token' },
})
