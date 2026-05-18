import type { proposals } from '@/shared/db/schema/proposals'
import type { Insert } from '@/shared/db/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { insertProposalSchema } from '@/shared/db/schema'
import { proposalCreateDal, proposalDuplicateDal } from '@/shared/entities/proposals/dal/server/mutations'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createEntityRouter } from '../../lib/create-entity-router'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { contractsRouter } from './contracts.router'
import { createDeliveryRouter } from './delivery.router'

// Resolved CRUD handlers — generic defaults with proposal-specific overrides
// for create (kind derivation + token gen + SOW snapshot) and duplicate
// (cherry-pick + owner reassignment + status reset).
const handlers = {
  ...createCrudDal(proposalServerSpec),
  create: proposalCreateDal,
  duplicate: proposalDuplicateDal,
}

// ID schema derived from the entity's select schema
const idSchema = z.object({ id: z.string().uuid() })

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (5 single-row operations) ──────────────────────────────────
    // Inlined instead of entity.crud() to preserve full tRPC type inference.
    // Each procedure uses entity toolkit's pre-scoped procedures (scope
    // middleware baked in) and calls DAL handlers directly.
    crud: createTRPCRouter({
      getById: entity.shareableProcedure
        .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
        .query(async ({ ctx, input }) => {
          // Token path: ctx.ability is null — CASL check skipped.
          // Session path: ctx.ability is non-null — enforce read permission.
          if (ctx.ability) {
            if (!ctx.ability.can('read', proposalServerSpec.caslSubject)) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to read Proposal' })
            }
          }
          const row = dalToTrpc(await handlers.getById(ctx, { id: input.id }))
          if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
          }
          return row
        }),

      create: entity.authedProcedure
        .input(insertProposalSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.ability.can('create', proposalServerSpec.caslSubject)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create Proposal' })
          }
          // Cast: insertProposalSchema omits server-derived fields (token, kind)
          // that proposalCreateDal adds internally before insert.
          return dalToTrpc(await handlers.create(ctx, input as Insert<typeof proposals>))
        }),

      update: entity.shareableProcedure
        .input(z.object({ id: z.string().uuid(), data: insertProposalSchema.partial(), token: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.ability) {
            if (!ctx.ability.can('update', proposalServerSpec.caslSubject)) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update Proposal' })
            }
          }
          return dalToTrpc(await handlers.update(ctx, { id: input.id, data: input.data }))
        }),

      delete: entity.authedProcedure
        .input(idSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.ability.can('delete', proposalServerSpec.caslSubject)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete Proposal' })
          }
          dalToTrpc(await handlers.delete(ctx, { id: input.id }))
        }),

      duplicate: entity.authedProcedure
        .input(idSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.ability.can('create', proposalServerSpec.caslSubject)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to duplicate Proposal' })
          }
          return dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
        }),
    }),

    // ── Business queries ──────────────────────────────────────────────────
    // Enriched reads and complex list with entity-specific joins/filters.
    // These use free-form return types — not Row<TTable>.
    business: createTRPCRouter({
      getFullView: entity.shareableProcedure
        .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await getFullView(ctx, input)) ?? null
        }),

      list: entity.authedProcedure
        .input(proposalListInputSchema)
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await listProposals(ctx, input))
        }),

      getFinanceOptions: entity.publicProcedure
        .query(async () => {
          return getFinanceOptions()
        }),
    }),

    // ── Service-layer sub-routers ─────────────────────────────────────────
    // These orchestrate external services (email, Zoho Sign) and call
    // DAL functions internally. Deferred from entity toolkit migration —
    // they mount as plain tRPC routers with their own auth logic.
    delivery: createDeliveryRouter(entity),
    contracts: contractsRouter,
  })
})
