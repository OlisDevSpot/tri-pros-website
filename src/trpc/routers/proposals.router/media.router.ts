// Each procedure is an adapter: one service call, mapped. The R2 lifecycle and optimize dispatch
// are hooks on the media CRUD, so they fire for every origin, not only callers of this router.
import z from 'zod'
import { proposalMediaVisibilities } from '@/shared/db/schema/proposal-media-files'
import { toProposalMediaView } from '@/shared/modules/proposals/media/dal/server/queries'
import { proposalService } from '@/shared/modules/proposals/service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { agentProcedure, createTRPCRouter } from '../../init'

export const proposalMediaRouter = createTRPCRouter({
  getUploadUrl: agentProcedure
    .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await proposalService.media.buildUploadTarget(ctx, input))
    }),

  create: agentProcedure
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
      return dalToTrpc(await proposalService.media.create(ctx, input))
    }),

  list: agentProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = dalToTrpc(await proposalService.media.list(ctx, input))
      return rows.map(toProposalMediaView)
    }),

  setVisibility: agentProcedure
    .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await proposalService.media.update(ctx, { id: input.id, data: { visibility: input.visibility } }))
    }),

  reorder: agentProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await proposalService.media.reorder(ctx, input))
    }),

  rename: agentProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await proposalService.media.update(ctx, { id: input.id, data: { name: input.name } }))
    }),

  delete: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await proposalService.media.delete(ctx, input))
    }),

  retryOptimization: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await proposalService.media.retryOptimization(ctx, input))
      return { success: true }
    }),
})
