import type { BinaContactPayload } from './types'

import env from '@/shared/config/server-env'

import { BINA_AUTH_HEADER } from './constants'
import { binaContactPayloadSchema } from './schemas'

// GoHighLevel provider client (leaf). Bina's lead intake arrives as a custom
// GHL workflow webhook. This client owns provider-native concerns ONLY: bearer
// auth verification + payload parsing. Translation to app-domain shapes lives in
// `lib/normalize-bina-lead.ts` (see service-architecture.md — domain translation
// belongs in a provider lib/, never in client signatures). Env is read lazily
// inside method bodies per provider-env-config rules.

export type BinaParseResult
  = | { ok: true, payload: BinaContactPayload }
    | { ok: false }

function createGohighlevelClient() {
  return {
    /**
     * Verify the bearer token Bina's GHL workflow sends. Returns false when a
     * secret is configured and the token mismatches. In dev with no secret set,
     * accepts (logs a warning). In production with no secret, returns false
     * (the route maps that to a 500 / unauthorized — fail closed).
     */
    verifyWebhookSecret({ authHeader }: { authHeader: string | null }): boolean {
      const secret = env.BINA_WEBHOOK_SECRET
      if (secret) {
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
        return token === secret
      }
      if (env.NODE_ENV === 'production') {
        console.error('[gohighlevel] BINA_WEBHOOK_SECRET not configured in production')
        return false
      }
      console.warn('[gohighlevel] no BINA_WEBHOOK_SECRET set — accepting (dev only)')
      return true
    },

    /** The auth header name Bina uses. Re-exported so the route reads one place. */
    authHeaderName: BINA_AUTH_HEADER,

    /** Parse + validate a raw Bina webhook body into the provider-native shape. */
    parseBinaWebhook(raw: unknown): BinaParseResult {
      const result = binaContactPayloadSchema.safeParse(raw)
      if (!result.success) {
        console.warn('[gohighlevel] Bina payload failed validation', result.error.flatten())
        return { ok: false }
      }
      return { ok: true, payload: result.data }
    },
  }
}

export const gohighlevelClient = createGohighlevelClient()
