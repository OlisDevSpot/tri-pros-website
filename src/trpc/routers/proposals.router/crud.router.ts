// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// see ../../DOCS.md#crud-five-slots-fixed
//
// `crud` is the proposal module service itself: it carries the engine's five
// slots on its top level (spread from proposalCrud) plus the proposal-COMPLETE
// `duplicate` override (incentive rows cloned, rollup re-driven), so no per-slot
// handler override lives here any more. Create enrichment (kind/token/SOW-snapshot)
// and the duplicate exclude/override config live in the createCrudDal config
// factory (modules/proposals/core/dal/server/crud.ts).
// see ../../../shared/modules/proposals/core/DOCS.md#duplicate-resets-and-redrives

import z from 'zod'

import { proposalSchemas, proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalService } from '@/shared/modules/proposals/service'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  crud: proposalService,
})
