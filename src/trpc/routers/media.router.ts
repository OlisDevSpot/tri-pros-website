import { extname } from 'node:path'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, mediaFiles } from '@/shared/db/schema'
import { BUCKET } from '@/shared/services/r2/client'
import { deleteObject } from '@/shared/services/r2/delete-object'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { agentProcedure, createTRPCRouter } from '../init'

export const mediaRouter = createTRPCRouter({
  getUploadUrl: agentProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      phase: z.enum(['before', 'during', 'after', 'main']),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const ext = extname(input.filename).toLowerCase()
      const fileId = crypto.randomUUID()
      const pathKey = `projects/${input.projectId}/${input.phase}/${fileId}${ext}`
      const publicUrl = `http://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/${pathKey}`

      const uploadUrl = await getPresignedUploadUrl({
        pathKey,
        mimeType: input.mimeType,
      })

      return { uploadUrl, pathKey, publicUrl }
    }),

  createMediaFile: agentProcedure
    .input(insertMediaFilesSchema.omit({ bucket: true }).extend({
      bucket: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(mediaFiles)
        .values({ ...input, bucket: input.bucket ?? BUCKET })
        .returning()

      return created
    }),

  deleteMediaFile: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [file] = await db
        .select({ pathKey: mediaFiles.pathKey })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, input.id))

      if (!file) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
      }

      await deleteObject(file.pathKey)
      await db.delete(mediaFiles).where(eq(mediaFiles.id, input.id))
    }),

  reorderMediaFiles: agentProcedure
    .input(z.object({
      updates: z.array(z.object({
        id: z.number(),
        sortOrder: z.number().int(),
      })),
    }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        for (const { id, sortOrder } of input.updates) {
          await tx
            .update(mediaFiles)
            .set({ sortOrder })
            .where(eq(mediaFiles.id, id))
        }
      })
    }),
})
