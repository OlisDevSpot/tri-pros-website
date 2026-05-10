import env from '@/shared/config/server-env'

import 'server-only'

/**
 * The public origin the app advertises to external services and to itself
 * when constructing absolute URLs that must be reachable from outside the
 * server (push notifications, webhook callbacks, qstash callbacks, GCal
 * watch URLs).
 *
 * In dev with the ngrok tunnel running, NGROK_URL takes precedence so all
 * external callbacks hit the tunneled origin instead of localhost (which
 * cloud services can't reach). In prod NGROK_URL is unset and we fall
 * through to NEXT_PUBLIC_BASE_URL.
 *
 * Used by:
 * - push notification navigate URLs (services/push/lib/build-payload.ts)
 * - GCal sync webhook callbacks (services/scheduling.service.ts)
 * - qstash job callback URLs (services/upstash/lib/create-job.ts)
 *
 * Server-only by design — clients should use NEXT_PUBLIC_BASE_URL directly.
 */
export function getPublicBaseUrl(): string {
  return env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
}
