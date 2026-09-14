// src/trpc/routers/proposals.router/media.router.ts
import type { ScopedContext } from '@/shared/dal/server/types'
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { isVisible } from '@/shared/dal/server/lib/scope'
import { proposalMediaVisibilities } from '@/shared/db/schema/proposal-media-files'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { toProposalMediaView } from '@/shared/modules/proposals/media/dal/server/queries'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { mediaService } from '@/shared/services/media/media.service'
import { proposalMediaStore } from '@/shared/services/media/stores'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { createTRPCRouter } from '../../init'
import { proposalMediaProcedure } from './procedures'

/** Throw FORBIDDEN unless the caller may update proposals (capability gate, orthogonal to row scope). */
function assertCanUpdate(ctx: ScopedContext) {
  if (ctx.ability?.cannot('update', 'Proposal') !== false) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this proposal.' })
  }
}

/** Throw NOT_FOUND unless the parent proposal is visible in the caller's scope (create/list/upload precursors). */
async function assertProposalVisible(ctx: ScopedContext, proposalId: string) {
  if (!(await isVisible(proposalServerSpec, ctx, proposalId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
  }
}

export const proposalMediaRouter = createTRPCRouter({
  getUploadUrl: proposalMediaProcedure
    .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      await assertProposalVisible(ctx, input.proposalId)
      return mediaService.buildUploadTarget(proposalMediaStore, {
        ownerId: input.proposalId,
        filename: input.filename,
        mimeType: input.mimeType,
      })
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
      await assertProposalVisible(ctx, input.proposalId)
      return dalToTrpc(await mediaService.createRecord(proposalMediaStore, ctx, input))
    }),

  list: proposalMediaProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      await assertProposalVisible(ctx, input.proposalId)
      const rows = dalToTrpc(await mediaService.list(proposalMediaStore, ctx, input.proposalId)) as ProposalMediaFile[]
      return rows.map(toProposalMediaView)
    }),

  setVisibility: proposalMediaProcedure
    .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      // Scoped update — the child bridge in `ctx.scope` makes an out-of-scope row not-found.
      dalToTrpc(await proposalMediaCrud.update(ctx, { id: input.id, data: { visibility: input.visibility } }))
    }),

  reorder: proposalMediaProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await mediaService.reorder(proposalMediaStore, ctx, input.updates))
    }),

  rename: proposalMediaProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await mediaService.rename(proposalMediaStore, ctx, input.id, input.name))
    }),

  delete: proposalMediaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      dalToTrpc(await mediaService.removeRecord(proposalMediaStore, ctx, input.id))
    }),

  retryOptimization: proposalMediaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCanUpdate(ctx)
      // Point probe on the child spec — replaces the old per-id authz join.
      if (!(await isVisible(proposalMediaServerSpec, ctx, input.id))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal media file not found' })
      }
      await mediaService.retryOptimization(proposalMediaStore, input.id)
      return { success: true }
    }),
})
