import { Buffer } from 'node:buffer'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { account, mediaFiles } from '@/shared/db/schema'
import { refreshAccessToken } from '@/shared/services/google-drive/lib/refresh-access-token'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { putObject } from '@/shared/services/r2/put-object'
import { optimizeImageJob } from '@/shared/services/upstash/jobs/optimize-image'
import { agentProcedure, createTRPCRouter } from '../../init'

const PORTFOLIO_BUCKET = R2_BUCKETS.portfolioProjects

export const googleDriveRouter = createTRPCRouter({
  getAccessToken: agentProcedure
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

  uploadFromFile: agentProcedure
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
      const publicUrl = `${R2_PUBLIC_DOMAINS[PORTFOLIO_BUCKET] ?? ''}/${pathKey}`

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
          fileExtension: ext,
          phase: input.phase,
          projectId: input.projectId,
        })
        .returning()

      if (input.mimeType.startsWith('image/')) {
        void optimizeImageJob.dispatch({ mediaFileId: created.id })
      }

      return created
    }),
})
