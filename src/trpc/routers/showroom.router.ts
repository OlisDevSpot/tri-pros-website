import { extname } from 'node:path'
import { TRPCError } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { getProjectForEdit } from '@/features/showroom/dal/server/get-project-for-edit'
import { getShowroomProjectDetail } from '@/features/showroom/dal/server/get-showroom-project-detail'
import { getShowroomProjects } from '@/features/showroom/dal/server/get-showroom-projects'
import { createShowroomProject, deleteShowroomProject, getAllProjects, updateShowroomProject } from '@/features/showroom/dal/server/manage-project'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, mediaFiles } from '@/shared/db/schema'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { deleteObject } from '@/shared/services/r2/delete-object'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

const PORTFOLIO_BUCKET = R2_BUCKETS.portfolioProjects

export const showroomRouter = createTRPCRouter({
  // ── Public procedures ──────────────────────────────────────────────

  getProjects: baseProcedure
    .query(async () => {
      return getShowroomProjects()
    }),

  getProjectDetail: baseProcedure
    .input(z.object({ accessor: z.string() }))
    .query(async ({ input }) => {
      return getShowroomProjectDetail(input.accessor)
    }),

  // ── Agent: project CRUD ────────────────────────────────────────────

  getAllProjects: agentProcedure
    .query(async () => {
      return getAllProjects()
    }),

  getProjectForEdit: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return getProjectForEdit(input.id)
    }),

  createProject: agentProcedure
    .input(projectFormSchema)
    .mutation(async ({ input }) => {
      const { scopeIds, ...projectData } = input
      return createShowroomProject(projectData, scopeIds ?? [])
    }),

  updateProject: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      const { scopeIds, ...projectData } = input.data
      return updateShowroomProject(input.id, projectData, scopeIds)
    }),

  deleteProject: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteShowroomProject(input.id)
      return { success: true }
    }),

  // ── Agent: media management ────────────────────────────────────────

  getUploadUrl: agentProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      phase: z.enum(mediaPhases),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const ext = extname(input.filename).toLowerCase()
      const fileId = crypto.randomUUID()
      const pathKey = `projects/${input.projectId}/${input.phase}/${fileId}${ext}`
      const publicUrl = `${R2_PUBLIC_DOMAINS[PORTFOLIO_BUCKET]}/${pathKey}`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: PORTFOLIO_BUCKET,
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
        .values({ ...input, bucket: input.bucket ?? PORTFOLIO_BUCKET })
        .returning()

      return created
    }),

  deleteMediaFile: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [file] = await db
        .select({ pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, input.id))

      if (!file) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
      }

      await deleteObject(file.bucket as typeof PORTFOLIO_BUCKET, file.pathKey)
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

  moveMediaPhase: agentProcedure
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

  bulkDeleteMediaFiles: agentProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const files = await db
        .select({ id: mediaFiles.id, pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
        .from(mediaFiles)
        .where(inArray(mediaFiles.id, input.ids))

      for (const file of files) {
        await deleteObject(file.bucket as typeof PORTFOLIO_BUCKET, file.pathKey)
      }

      await db.delete(mediaFiles).where(inArray(mediaFiles.id, input.ids))
    }),

  renameMediaFile: agentProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ input }) => {
      await db
        .update(mediaFiles)
        .set({ name: input.name })
        .where(eq(mediaFiles.id, input.id))
    }),

  toggleHeroImage: agentProcedure
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

        // Clear hero from all other images in the same project
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
