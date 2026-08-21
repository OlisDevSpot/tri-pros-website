import { Buffer } from 'node:buffer'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { mediaService } from '@/shared/services/media/media.service'
import { projectMediaStore } from '@/shared/services/media/stores'
import { googleDriveTokenService } from '@/shared/services/providers/google-drive/token.service'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { agentProcedure, createTRPCRouter } from '../../init'

export const googleDriveRouter = createTRPCRouter({
  getAccessToken: agentProcedure
    .query(async ({ ctx }) => {
      return { accessToken: await googleDriveTokenService.getValidAccessToken(ctx.session.user.id) }
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
      const accessToken = await googleDriveTokenService.getValidAccessToken(ctx.session.user.id)

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
      const pathKey = projectMediaStore.buildPathKey(input.projectId, fileUuid, ext, { phase: input.phase })
      const publicUrl = `${R2_PUBLIC_DOMAINS[projectMediaStore.bucket] ?? ''}/${pathKey}`

      const buffer = Buffer.from(await driveResponse.arrayBuffer())
      await r2Client.putObject(projectMediaStore.bucket, pathKey, buffer, input.mimeType)

      // Persist + dispatch optimization through the media facade — same path as a
      // regular project-media upload (see projects.router/media.router.ts create).
      return dalToTrpc(await mediaService.createRecord(projectMediaStore, ctx, {
        name: input.name.replace(/\.[^/.]+$/, ''),
        url: publicUrl,
        pathKey,
        bucket: projectMediaStore.bucket,
        mimeType: input.mimeType,
        fileExtension: ext,
        phase: input.phase,
        projectId: input.projectId,
      }))
    }),
})
