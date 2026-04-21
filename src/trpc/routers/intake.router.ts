import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import z from 'zod'
import env from '@/shared/config/server-env'
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
  // Returns a presigned R2 upload URL for a call recording
  getRecordingUploadUrl: baseProcedure
    .input(z.object({
      contentType: z.enum(['audio/mpeg', 'audio/mp4']),
      customerName: z.string().min(1),
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

      const slug = input.customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const key = `recordings/${slug}-${crypto.randomUUID()}.mp3`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: R2_BUCKETS.homeownerFiles,
        pathKey: key,
        mimeType: input.contentType,
        expiresIn: 900,
      })

      return { uploadUrl, key }
    }),
})
