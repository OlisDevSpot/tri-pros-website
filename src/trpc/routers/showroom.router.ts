import { extname } from 'node:path'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getProjectForEdit } from '@/shared/dal/server/showroom/get-project-for-edit'
import { getShowroomProjectDetail } from '@/shared/dal/server/showroom/get-showroom-project-detail'
import { getShowroomProjects } from '@/shared/dal/server/showroom/get-showroom-projects'
import { createShowroomProject, deleteShowroomProject, getAllProjects, updateShowroomProject } from '@/shared/dal/server/showroom/manage-project'
import { db } from '@/shared/db'
import { insertMediaFilesSchema, mediaFiles } from '@/shared/db/schema'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { BUCKET } from '@/shared/services/r2/client'
import { deleteObject } from '@/shared/services/r2/delete-object'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

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
