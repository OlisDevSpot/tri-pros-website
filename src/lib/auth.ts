import { betterAuth } from 'better-auth'
import env from '@/config/env'

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
})
