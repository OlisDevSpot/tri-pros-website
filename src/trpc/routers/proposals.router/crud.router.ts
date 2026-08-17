// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// see ../../DOCS.md#crud-five-slots-fixed
//
// crud.duplicate is overridden — the generic duplicateImpl only copies the
// parent row, never `proposal_incentives` (a Wave-2 child table), which would
// silently drop discounts/exclusive-offers on the copy. Create enrichment and
// duplicate config live on proposalServerSpec.hooks and .duplicate.
// see ../../../shared/entities/proposals/DOCS.md#duplicate-resets-and-redrives

import z from 'zod'

import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { duplicateProposalWithIncentives } from '@/shared/entities/proposals/dal/server/duplicate'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  crud: proposalCrud,
  handlers: { duplicate: duplicateProposalWithIncentives },
})
