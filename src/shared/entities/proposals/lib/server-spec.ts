import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { proposalVisibility } from '@/shared/entities/proposals/lib/visibility'

// The update schema is the insert schema but .partial() — allows updating
// any field. `kind` is excluded from insert (server-derived), so it's also
// excluded from update.
const updateProposalSchema = insertProposalSchema.partial()

/**
 * Concrete-typed schemas for tRPC CRUD router type inference.
 * The spec also holds these objects, but type-erased via the EntityServerSpec
 * interface (fine for DAL's runtime .parse()). Pass this to createCrudRouter
 * for full client-side type inference.
 */
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
    // These 3 JSONB columns need deep merge on update, not replace.
    // Phase 1a declares them; Phase 1b implements the merge logic.
    jsonbMergeColumns: [
      proposals.formMetaJSON,
      proposals.projectJSON,
      proposals.fundingJSON,
    ] as const,
  },
} satisfies EntityServerSpec<typeof proposals>
