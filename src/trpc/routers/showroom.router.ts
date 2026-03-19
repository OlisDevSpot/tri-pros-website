import { Buffer } from 'node:buffer'
import { extname } from 'node:path'
import { TRPCError } from '@trpc/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getProjectForEdit } from '@/features/showroom/dal/server/get-project-for-edit'
import { getShowroomProjectDetail } from '@/features/showroom/dal/server/get-showroom-project-detail'
import { getShowroomProjects } from '@/features/showroom/dal/server/get-showroom-projects'
import { createShowroomProject, deleteShowroomProject, getAllProjects, updateShowroomProject } from '@/features/showroom/dal/server/manage-project'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { account, insertMediaFilesSchema, mediaFiles } from '@/shared/db/schema'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { refreshAccessToken } from '@/shared/services/google-drive/lib/refresh-access-token'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { deleteObject } from '@/shared/services/r2/delete-object'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { putObject } from '@/shared/services/r2/put-object'
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

  // ── Agent: Google Drive token ──────────────────────────────────────

  getGoogleAccessToken: agentProcedure
    .query(async ({ ctx }) => {
      const googleAccount = await db.query.account.findFirst({
        where: and(
          eq(account.userId, ctx.session.user.id),
          eq(account.providerId, 'google'),
        ),
      })

      if (!googleAccount) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No Google account linked' })
      }

      if (!googleAccount.refreshToken) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Google Drive connection expired — please sign out and sign in again' })
      }

      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      if (googleAccount.accessTokenExpiresAt && googleAccount.accessTokenExpiresAt > fiveMinutesFromNow) {
        return { accessToken: googleAccount.accessToken! }
      }

      const { accessToken, expiresAt } = await refreshAccessToken({ refreshToken: googleAccount.refreshToken })
      await db
        .update(account)
        .set({ accessToken, accessTokenExpiresAt: expiresAt })
        .where(eq(account.id, googleAccount.id))

      return { accessToken }
    }),

  // ── Agent: Google Drive → R2 upload ───────────────────────────────

  uploadFromDriveFile: agentProcedure
    .input(z.object({
      driveFileId: z.string(),
      name: z.string(),
      mimeType: z.string(),
      projectId: z.string().uuid(),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ ctx, input }) => {
      const googleAccount = await db.query.account.findFirst({
        where: and(
          eq(account.userId, ctx.session.user.id),
          eq(account.providerId, 'google'),
        ),
      })

      if (!googleAccount?.refreshToken) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No Google Drive connection — please sign out and sign in again' })
      }

      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      let accessToken = googleAccount.accessToken
      if (!googleAccount.accessTokenExpiresAt || googleAccount.accessTokenExpiresAt <= fiveMinutesFromNow) {
        const refreshed = await refreshAccessToken({ refreshToken: googleAccount.refreshToken })
        await db
          .update(account)
          .set({ accessToken: refreshed.accessToken, accessTokenExpiresAt: refreshed.expiresAt })
          .where(eq(account.id, googleAccount.id))
        accessToken = refreshed.accessToken
      }

      const driveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.driveFileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )

      if (!driveResponse.ok) {
        const errorBody = await driveResponse.json().catch(() => ({})) as { error?: { message?: string, errors?: { reason?: string }[] } }
        const reason = errorBody.error?.errors?.[0]?.reason
        const googleMessage = errorBody.error?.message ?? driveResponse.statusText

        if (driveResponse.status === 403 && reason === 'insufficientPermissions') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Google Drive access not authorized. Please sign out and sign back in to grant Drive permission.',
          })
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Drive download failed (${driveResponse.status}): ${googleMessage}`,
        })
      }

      const ext = input.name.includes('.') ? `.${input.name.split('.').pop()}` : ''
      const fileUuid = crypto.randomUUID()
      const pathKey = `projects/${input.projectId}/${input.phase}/${fileUuid}${ext}`
      const publicUrl = `${R2_PUBLIC_DOMAINS[PORTFOLIO_BUCKET]}/${pathKey}`

      const buffer = Buffer.from(await driveResponse.arrayBuffer())
      await putObject(PORTFOLIO_BUCKET, pathKey, buffer, input.mimeType)

      const [created] = await db
        .insert(mediaFiles)
        .values({
          name: input.name.replace(/\.[^/.]+$/, ''),
          url: publicUrl,
          pathKey,
          bucket: PORTFOLIO_BUCKET,
          mimeType: input.mimeType,
          phase: input.phase,
          projectId: input.projectId,
        })
        .returning()

      return created
    }),
})
