import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import env from '@/shared/config/server-env'
import 'server-only'

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })

// Keyed by the token: one link is one homeowner. A view notifies staff, a move-forward request emails
// them, and a document is rendered on our server.
export const SHARE_LINK_LIMITS = {
  view: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:view' }),
  moveForward: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'share-link:move-forward' }),
  document: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:document' }),
}
