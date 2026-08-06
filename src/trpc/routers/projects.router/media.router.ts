import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { TRPCError } from '@trpc/server'
import { and, eq, inArray, like } from 'drizzle-orm'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, mediaFiles, meetings, proposalMediaFiles, proposals } from '@/shared/db/schema'
import { resetOptimizationStatus } from '@/shared/entities/media-files/dal/server/queries'
import { deriveOriginalMediaUrl, getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { mediaService } from '@/shared/services/media/media.service'
import { projectMediaStore } from '@/shared/services/media/stores'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
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
    .mutation(async ({ input }) =>
      mediaService.createRecord(projectMediaStore, { ...input, bucket: input.bucket ?? projectMediaStore.bucket }),
    ),

  retryOptimization: agentProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ input }) => {
      await resetOptimizationStatus(input.mediaFileId)
      void optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId: input.mediaFileId })
      return { success: true }
    }),

  delete: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await mediaService.removeRecord(projectMediaStore, input.id)
    }),

  reorder: agentProcedure
    .input(z.object({
      updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })),
    }))
    .mutation(async ({ input }) => {
      await mediaService.reorder(projectMediaStore, input.updates)
    }),

  movePhase: agentProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        for (const id of input.ids) {
          await tx
            .update(mediaFiles)
            .set({ phase: input.phase })
            .where(eq(mediaFiles.id, id))
        }
      })
    }),

  bulkDelete: agentProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      for (const id of input.ids)
        await mediaService.removeRecord(projectMediaStore, id)
    }),

  rename: agentProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ input }) => {
      await mediaService.rename(projectMediaStore, input.id, input.name)
    }),

  toggleHero: agentProcedure
    .input(z.object({
      id: z.number(),
      isHeroImage: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (input.isHeroImage) {
        const [file] = await db
          .select({ projectId: mediaFiles.projectId })
          .from(mediaFiles)
          .where(eq(mediaFiles.id, input.id))

        if (!file) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
        }

        await db
          .update(mediaFiles)
          .set({ isHeroImage: false })
          .where(eq(mediaFiles.projectId, file.projectId))
      }

      await db
        .update(mediaFiles)
        .set({ isHeroImage: input.isHeroImage })
        .where(eq(mediaFiles.id, input.id))
    }),

  listImportableProposalMedia: agentProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: proposalMediaFiles.id,
          proposalId: proposalMediaFiles.proposalId,
          proposalLabel: proposals.label,
          name: proposalMediaFiles.name,
          mimeType: proposalMediaFiles.mimeType,
          pathKey: proposalMediaFiles.pathKey,
          bucket: proposalMediaFiles.bucket,
          optimizationStatus: proposalMediaFiles.optimizationStatus,
          optimizationVariants: proposalMediaFiles.optimizationVariants,
        })
        .from(proposalMediaFiles)
        .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
        .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
        .where(and(eq(meetings.projectId, input.projectId), like(proposalMediaFiles.mimeType, 'image/%')))

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
    .mutation(async ({ input }) => {
      // Authorization: only copy media that actually belongs to a proposal on
      // THIS project's meetings (prevents importing arbitrary proposal media by id).
      const sources = await db
        .select({
          id: proposalMediaFiles.id,
          name: proposalMediaFiles.name,
          mimeType: proposalMediaFiles.mimeType,
          fileExtension: proposalMediaFiles.fileExtension,
          pathKey: proposalMediaFiles.pathKey,
          bucket: proposalMediaFiles.bucket,
        })
        .from(proposalMediaFiles)
        .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
        .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
        .where(and(eq(meetings.projectId, input.projectId), inArray(proposalMediaFiles.id, input.proposalMediaFileIds), like(proposalMediaFiles.mimeType, 'image/%')))

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
        await mediaService.createRecord(projectMediaStore, {
          projectId: input.projectId,
          name: src.name,
          mimeType: src.mimeType,
          fileExtension: ext,
          pathKey: destKey,
          bucket: projectMediaStore.bucket,
          url: publicUrl,
          phase: 'uncategorized',
        })
        imported++
      }
      return { imported }
    }),
})
