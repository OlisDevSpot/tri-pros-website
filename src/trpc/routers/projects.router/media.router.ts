import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, mediaFiles } from '@/shared/db/schema'
import { resetOptimizationStatus } from '@/shared/entities/media-files/dal/server/queries'
import { mediaService } from '@/shared/services/media/media.service'
import { projectMediaStore } from '@/shared/services/media/stores'
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
})
