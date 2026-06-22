// see ../../../docs/codebase-conventions/urls-and-origins.md
import env from '@/shared/config/server-env'

import 'server-only'

/**
 * An absolute URL reachable from the public internet — the origin this running
 * instance advertises to external services (push, webhooks, qstash, GCal) and
 * in transactional email links. Tunnel-aware: NGROK_URL wins in dev so external
 * callbacks hit the tunnel instead of localhost. No path → the origin alone.
 * Server-only; clients use mainSiteUrl(). see ../lib/main-site-url.ts
 */
export function publicUrl(path?: string): string {
  const origin = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
  return path ? `${origin}${path}` : origin
}
