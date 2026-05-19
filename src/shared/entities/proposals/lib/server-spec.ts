import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { proposalVisibility } from '@/shared/entities/proposals/lib/visibility'

// `kind` is server-derived (omitted from insert schema), so update inherits the exclusion.
const updateProposalSchema = insertProposalSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: updateProposalSchema,
}

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
  update: {
    // see ./DOCS.md#jsonb-merge-on-update
    jsonbMergeColumns: [
      proposals.formMetaJSON,
      proposals.projectJSON,
      proposals.fundingJSON,
    ] as const,
  },
} satisfies EntityServerSpec<typeof proposals>
