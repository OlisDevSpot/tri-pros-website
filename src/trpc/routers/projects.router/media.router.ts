import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { insertProjectMediaFilesSchema } from '@/shared/db/schema'
import { deriveOriginalMediaUrl, getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { projectsService } from '@/shared/modules/projects/service'
import { listImportableProjectMedia } from '@/shared/modules/proposals/media/dal/server/queries'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { agentProcedure, createTRPCRouter } from '../../init'

export const mediaRouter = createTRPCRouter({
  getUploadUrl: agentProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      phase: z.enum(mediaPhases),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { uploadUrl, pathKey, bucket } = dalToTrpc(await projectsService.media.buildUploadTarget(ctx, input))
      return { uploadUrl, pathKey, publicUrl: `${R2_PUBLIC_DOMAINS[bucket as R2BucketName] ?? ''}/${pathKey}` }
    }),

  create: agentProcedure
    .input(insertProjectMediaFilesSchema.omit({ bucket: true }).extend({
      bucket: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await projectsService.media.create(ctx, { ...input, bucket: input.bucket ?? projectMediaStore.bucket })),
    ),

  retryOptimization: agentProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.retryOptimization(ctx, { id: input.mediaFileId }))
      return { success: true }
    }),

  delete: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.delete(ctx, { id: input.id }))
    }),

  reorder: agentProcedure
    .input(z.object({
      updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.reorder(ctx, input))
    }),

  movePhase: agentProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.movePhase(ctx, input))
    }),

  bulkDelete: agentProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      // A row that is already gone is not an error for a bulk selection (the user
      // may be acting on a stale list) — but any other failure still surfaces.
      for (const id of input.ids) {
        const result = await projectsService.media.delete(ctx, { id })
        if (!result.success && result.error.type !== 'not-found') {
          dalToTrpc(result)
        }
      }
    }),

  rename: agentProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.update(ctx, { id: input.id, data: { name: input.name } }))
    }),

  toggleHero: agentProcedure
    .input(z.object({
      id: z.number(),
      isHeroImage: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectsService.media.setHero(ctx, input))
    }),

  listImportableProposalMedia: agentProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await listImportableProjectMedia(input.projectId)

      // Public bucket — derive the best display URL (variant or original) for
      // the picker preview. No presigning.
      const withUrl = rows.map(r => ({
        id: r.id,
        proposalId: r.proposalId,
        proposalLabel: r.proposalLabel,
        name: r.name,
        mimeType: r.mimeType,
        url: getOptimizedSrc({
          url: deriveOriginalMediaUrl(r.pathKey, r.bucket),
          pathKey: r.pathKey,
          bucket: r.bucket,
          optimizationStatus: r.optimizationStatus,
          optimizationVariants: r.optimizationVariants,
        }),
      }))

      // Group by proposal for the dialog.
      const byProposal = new Map<string, { proposalId: string, proposalLabel: string, items: typeof withUrl }>()
      for (const item of withUrl) {
        const g = byProposal.get(item.proposalId) ?? { proposalId: item.proposalId, proposalLabel: item.proposalLabel, items: [] }
        g.items.push(item)
        byProposal.set(item.proposalId, g)
      }
      return [...byProposal.values()]
    }),

  importFromProposal: agentProcedure
    .input(z.object({ projectId: z.string().uuid(), proposalMediaFileIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await projectsService.media.importFromProposal(ctx, input))
    }),
})
