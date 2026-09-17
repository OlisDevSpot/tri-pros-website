import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { insertMediaFilesSchema } from '@/shared/db/schema'
import { deriveOriginalMediaUrl, getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { moveMediaPhase, setHeroImage } from '@/shared/modules/projects/media/dal/server/mutations'
import { listImportableProjectMedia } from '@/shared/modules/proposals/media/dal/server/queries'
import { mediaService } from '@/shared/services/media/media.service'
import { projectMediaStore } from '@/shared/services/media/stores'
import { r2Client } from '@/shared/services/providers/r2/client'
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
    .mutation(async ({ input }) => {
      const { uploadUrl, pathKey, bucket } = await mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      })
      const publicUrl = `${R2_PUBLIC_DOMAINS[bucket] ?? ''}/${pathKey}`
      return { uploadUrl, pathKey, publicUrl }
    }),

  create: agentProcedure
    .input(insertMediaFilesSchema.omit({ bucket: true }).extend({
      bucket: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await mediaService.createRecord(projectMediaStore, ctx, { ...input, bucket: input.bucket ?? projectMediaStore.bucket })),
    ),

  retryOptimization: agentProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ input }) => {
      await mediaService.retryOptimization(projectMediaStore, input.mediaFileId)
      return { success: true }
    }),

  delete: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.removeRecord(projectMediaStore, ctx, input.id))
    }),

  reorder: agentProcedure
    .input(z.object({
      updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.reorder(projectMediaStore, ctx, input.updates))
    }),

  movePhase: agentProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await moveMediaPhase(ctx, input.ids, input.phase))
    }),

  bulkDelete: agentProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids)
        dalToTrpc(await mediaService.removeRecord(projectMediaStore, ctx, id))
    }),

  rename: agentProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.rename(projectMediaStore, ctx, input.id, input.name))
    }),

  toggleHero: agentProcedure
    .input(z.object({
      id: z.number(),
      isHeroImage: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await setHeroImage(ctx, input.id, input.isHeroImage))
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
      // Authorization: only copy media that actually belongs to a proposal on
      // THIS project's meetings (prevents importing arbitrary proposal media by id).
      const sources = await listImportableProjectMedia(input.projectId, input.proposalMediaFileIds)

      let imported = 0
      for (const src of sources) {
        if (!src.pathKey || !src.bucket)
          continue
        const ext = src.fileExtension || (src.pathKey.includes('.') ? `.${src.pathKey.split('.').pop()}` : '')
        const destKey = `projects/${input.projectId}/uncategorized/${crypto.randomUUID()}${ext}`
        await r2Client.copyObject({
          sourceBucket: src.bucket as R2BucketName,
          sourceKey: src.pathKey,
          destBucket: projectMediaStore.bucket,
          destKey,
        })
        const publicUrl = `${R2_PUBLIC_DOMAINS[projectMediaStore.bucket] ?? ''}/${destKey}`
        dalToTrpc(await mediaService.createRecord(projectMediaStore, ctx, {
          projectId: input.projectId,
          name: src.name,
          mimeType: src.mimeType,
          fileExtension: ext,
          pathKey: destKey,
          bucket: projectMediaStore.bucket,
          url: publicUrl,
          phase: 'uncategorized',
        }))
        imported++
      }
      return { imported }
    }),
})
