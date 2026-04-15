import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/shared/domains/auth/server'

export const { GET, POST } = toNextJsHandler(auth)
