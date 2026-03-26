import { Redis } from '@upstash/redis'
import env from '@/shared/config/server-env'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})
