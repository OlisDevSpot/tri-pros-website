import { createHash } from 'node:crypto'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import env from '@/shared/config/server-env'
import 'server-only'

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })

const view = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:view' })
const moveForward = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'share-link:move-forward' })
const document = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:document' })

function hashed(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// The homeowner's link is how a proposal gets signed: a limiter outage lets the request through
// instead of failing the homeowner's view, request or document.
async function limit(limiter: Ratelimit, name: string, token: string): Promise<{ success: boolean }> {
  try {
    return await limiter.limit(hashed(token))
  }
  catch (error) {
    console.error(`[share-link-rate-limit] ${name} limiter failed; letting the request through`, error)
    return { success: true }
  }
}

// One link is one homeowner. A view notifies staff, a move-forward request emails them, and a document
// is rendered on our server. Keyed by a hash of the token so no live link sits in the store.
export const SHARE_LINK_LIMITS = {
  view: (token: string) => limit(view, 'view', token),
  moveForward: (token: string) => limit(moveForward, 'move-forward', token),
  document: (token: string) => limit(document, 'document', token),
}
