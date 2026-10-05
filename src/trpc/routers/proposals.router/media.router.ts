// src/trpc/routers/proposals.router/media.router.ts
//
// Plain leaf over `proposalService.media`: each procedure is an adapter —
// capability gate, one service call, map. Parent/own-row visibility probes still
// live on the service (`create`'s parent check, `retryOptimization`'s own-row
// check); the R2 lifecycle and optimize dispatch are `createCrudDal` hooks on
// the media unit's CRUD (C32, D5), so they fire for every origin, not just
// callers that go through this router.
import type { ScopedContext } from '@/shared/dal/server/types'
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { proposalMediaVisibilities } from '@/shared/db/schema/proposal-media-files'
import { toProposalMediaView } from '@/shared/modules/proposals/media/dal/server/queries'
import { proposalService } from '@/shared/modules/proposals/service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { createTRPCRouter } from '../../init'
import { proposalMediaProcedure } from './procedures'

/**
 * Throw FORBIDDEN unless the caller may update proposals (CASL capability gate,
 * orthogonal to row scope — the router-layer counterpart of createCrudRouter's
 * `assertCan`). #285 D-16/D-17 retires it once the DAL self-scopes per action.
 */
function assertCanUpdate(ctx: ScopedContext) {
  if (ctx.ability?.cannot('update', 'Proposal') !== false) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this proposal.' })
  }
}

export const proposalMediaRouter = createTRPCRouter({
  getUploadUrl: proposalMediaProcedure
    .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      return dalToTrpc(await proposalService.media.buildUploadTarget(ctx, input))
    }),

  create: proposalMediaProcedure
    .input(z.object({
      proposalId: z.string().uuid(),
      name: z.string().min(1).max(80),
      pathKey: z.string(),
      bucket: z.string(),
      mimeType: z.string(),
      fileExtension: z.string(),
      duration: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      return dalToTrpc(await proposalService.media.create(ctx, input))
    }),

  list: proposalMediaProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      const rows = dalToTrpc(await proposalService.media.list(ctx, input))
      return rows.map(toProposalMediaView)
    }),

  setVisibility: proposalMediaProcedure
    .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      // Scoped update — the child bridge in `ctx.scope` makes an out-of-scope row not-found.
      dalToTrpc(await proposalService.media.update(ctx, { id: input.id, data: { visibility: input.visibility } }))
    }),

  reorder: proposalMediaProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await proposalService.media.reorder(ctx, input))
    }),

  rename: proposalMediaProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await proposalService.media.update(ctx, { id: input.id, data: { name: input.name } }))
    }),

  delete: proposalMediaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await proposalService.media.delete(ctx, input))
    }),

  retryOptimization: proposalMediaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await proposalService.media.retryOptimization(ctx, input))
      return { success: true }
    }),
})
