import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { agentProfileSchema } from '@/shared/entities/users/schemas'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'

import { agentProcedure, createTRPCRouter } from '../init'

export const agentSettingsRouter = createTRPCRouter({
  getProfile: agentProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select()
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1)

    return profile ?? null
  }),

  updateProfile: agentProcedure
    .input(
      z.object({
        agentProfileJSON: agentProfileSchema.nullish(),
        birthdate: z.string().nullish(),
        funFact: z.string().nullish(),
        phone: z.string().nullish(),
        startDate: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(user)
        .set({
          agentProfileJSON: input.agentProfileJSON,
          birthdate: input.birthdate,
          funFact: input.funFact,
          phone: input.phone,
          startDate: input.startDate,
        })
        .where(eq(user.id, ctx.session.user.id))
        .returning()

      return updated
    }),

  getHeadshotUploadUrl: agentProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pathKey = `agent-headshots/${ctx.session.user.id}/${Date.now()}-${input.filename}`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: R2_BUCKETS.companyDocs,
        mimeType: input.mimeType,
        pathKey,
      })

      const publicDomain = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]
      const publicUrl = `${publicDomain}/${pathKey}`

      return { pathKey, publicUrl, uploadUrl }
    }),
})
