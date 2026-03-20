import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { eq, inArray } from 'drizzle-orm'
import z from 'zod'
import env from '@/shared/config/server-env'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { R2_BUCKETS } from '@/shared/services/r2/buckets'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { baseProcedure, createTRPCRouter } from '../init'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:upload',
})

export const intakeRouter = createTRPCRouter({
  // Validates a lead source token and returns form configuration
  getByToken: baseProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.token, input.token))
        .limit(1)

      if (!row || !row.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'This link is no longer active.' })
      }

      const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

      return {
        leadSourceSlug: row.slug,
        leadSourceName: row.name,
        formConfig,
      }
    }),

  // Returns all internal users (agents + super-admins) for "Closed By" dropdown
  getInternalUsers: baseProcedure
    .query(async () => {
      const internalUsers = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.role, ['agent', 'super-admin']))

      return internalUsers
    }),

  // Returns a presigned R2 upload URL for a call recording
  getRecordingUploadUrl: baseProcedure
    .input(z.object({
      contentType: z.enum(['audio/mpeg', 'audio/mp4']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit by IP
      const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await uploadRatelimit.limit(ip)

      if (!success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many upload attempts. Please try again later.',
        })
      }

      const timestamp = Date.now()
      const key = `recordings/${timestamp}-${crypto.randomUUID()}.mp3`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: R2_BUCKETS.telemarketingRecordings,
        pathKey: key,
        mimeType: input.contentType,
        expiresIn: 900,
      })

      return { uploadUrl, key }
    }),
})
