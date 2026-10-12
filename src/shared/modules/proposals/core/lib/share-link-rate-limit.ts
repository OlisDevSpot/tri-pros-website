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

// One link is one homeowner. A view notifies staff, a move-forward request emails them, and a document
// is rendered on our server. Keyed by a hash of the token so no live link sits in the store.
export const SHARE_LINK_LIMITS = {
  view: (token: string) => view.limit(hashed(token)),
  moveForward: (token: string) => moveForward.limit(hashed(token)),
  document: (token: string) => document.limit(hashed(token)),
}
