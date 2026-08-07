import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/shared/domains/auth/server'

// Colocate auth (session lookups, sign-in) with the Neon DB (aws-us-west-2).
// pdx1 = Vercel's us-west-2 (Oregon); default iad1 (us-east-1) would make
// every session verification a cross-country round-trip.
export const preferredRegion = 'pdx1'

export const { GET, POST } = toNextJsHandler(auth)
