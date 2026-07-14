import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { updateUserProfile } from '@/shared/entities/users/dal/server/mutations'
import { headshotCropDataSchema } from '@/shared/entities/users/schemas'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

import { agentProcedure, createTRPCRouter } from '../init'
import { dalToTrpc } from '../lib/dal-to-trpc'

export const agentSettingsRouter = createTRPCRouter({
  getProfile: agentProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select()
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1)

    return profile ?? null
  }),

  // Clients send ONLY the fields they own (brand section vs. headshot
  // upload) — disjoint patches are what kill the race; see
  // users/dal/server/mutations.ts#updateUserProfile.
  updateProfile: agentProcedure
    .input(
      z.object({
        quote: z.string().nullish(),
        bio: z.string().nullish(),
        yearsOfExperience: z.number().int().min(0).nullish(),
        tradeSpecialties: z.array(z.string()).nullish(),
        languagesSpoken: z.array(z.string()).nullish(),
        certifications: z.array(z.string()).nullish(),
        headshotUrl: z.string().nullish(),
        headshotCropData: headshotCropDataSchema.nullish(),
        birthdate: z.string().nullish(),
        funFact: z.string().nullish(),
        phone: z.string().nullish(),
        startDate: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await updateUserProfile(ctx.session.user.id, input)),
    ),

  getHeadshotUploadUrl: agentProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pathKey = `agent-headshots/${ctx.session.user.id}/${Date.now()}-${input.filename}`

      const uploadUrl = await r2Client.getPresignedUploadUrl({
        bucket: R2_BUCKETS.companyDocs,
        mimeType: input.mimeType,
        pathKey,
      })

      const publicDomain = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]
      const publicUrl = `${publicDomain}/${pathKey}`

      return { pathKey, publicUrl, uploadUrl }
    }),
})
