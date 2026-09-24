// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
//
// `crud` is the proposal module service itself: it carries the engine's five
// slots on its top level (spread from proposalCrud) plus the module's verbs, so
// the router and every other caller share ONE server API. Create enrichment,
// the lock ladder and the proposal-COMPLETE duplicate (incentive rows cloned +
// rollup re-driven in `duplicate.after`) all live in the createCrudDal config
// factory (modules/proposals/core/dal/server/crud.ts) — never here.

import z from 'zod'

import { proposalSchemas, proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalService } from '@/shared/modules/proposals/service'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  crud: proposalService,
})
