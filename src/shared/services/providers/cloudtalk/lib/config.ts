import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * CloudTalk env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Pattern mirror of `providers/twilio/lib/config.ts` — provider owns its
 * full env story. server-env imports `cloudtalkEnvFragment` to spread into
 * the central schema and `cloudtalkConfigMeta` for the boot banner. ALL
 * consumers (the CloudTalk client, route handlers verifying the webhook
 * secret, the voip-routing service) import from THIS file, never from
 * server-env.
 *
 * Note on the webhook secret: CloudTalk does NOT sign webhooks (no HMAC) —
 * the secret is passed as a query param on the inbound URL. The SAME value
 * protects both inbound surfaces:
 *   1. Mid-call routing endpoints (`/api/voip/routing/*`) — voip-in-house Phase 1
 *   2. Post-call webhook handler (`/api/webhooks/cloudtalk/route.ts`) — voip-campaigns Phase 1
 * Same trust model; one secret value, configured once into CloudTalk's dashboard.
 */
export const cloudtalkEnvFragment = z.object({
  // HTTP Basic auth — Access Key ID is the username, Access Key Secret is the password.
  CLOUDTALK_ACCESS_KEY_ID: z.string().optional(),
  CLOUDTALK_ACCESS_KEY_SECRET: z.string().optional(),
  // Shared inbound-traffic secret (see file header). 32+ chars when present
  // so a half-set secret can't slip through.
  CLOUDTALK_WEBHOOK_SECRET: z.string().min(32).optional(),
  // Optional comma-separated CIDRs for Vercel edge allowlist. Not part of
  // the runtime config — consumed directly by the edge config if set.
  CLOUDTALK_WEBHOOK_IP_ALLOWLIST: z.string().optional(),
})

export type ParsedCloudtalkEnv = z.infer<typeof cloudtalkEnvFragment>

export interface CloudtalkRuntimeConfig {
  accessKeyId: string
  accessKeySecret: string
  webhookSecret: string
}

/**
 * Required env keys for CloudTalk to operate. All three are needed for
 * either the outbound REST surface (Basic auth) or the inbound webhook
 * surface (shared-secret verify) to function.
 *
 * `CLOUDTALK_WEBHOOK_IP_ALLOWLIST` is intentionally excluded — it's an
 * edge-network detail, not part of the runtime config consumed by app code.
 */
const REQUIRED_KEYS = [
  'CLOUDTALK_ACCESS_KEY_ID',
  'CLOUDTALK_ACCESS_KEY_SECRET',
  'CLOUDTALK_WEBHOOK_SECRET',
] as const satisfies ReadonlyArray<keyof ParsedCloudtalkEnv>

function listMissingCloudtalk(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

/**
 * Narrow the parsed env (CloudTalk fields as `string | undefined`) into a
 * runtime config (every required field as `string`). Throws
 * `NotConfiguredError` listing all missing vars if any required key is unset.
 *
 * Pure function — does not read process.env. Use `getCloudtalkConfig()` for
 * the cached, env-bound accessor.
 */
export function buildCloudtalkConfig(parsed: ParsedCloudtalkEnv): CloudtalkRuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('cloudtalk', missing)
  }
  return {
    accessKeyId: parsed.CLOUDTALK_ACCESS_KEY_ID!,
    accessKeySecret: parsed.CLOUDTALK_ACCESS_KEY_SECRET!,
    webhookSecret: parsed.CLOUDTALK_WEBHOOK_SECRET!,
  }
}

/**
 * Cached accessor — the public entry point for every consumer needing
 * CloudTalk config. Lazy: doesn't read env until first call.
 *
 * Throws `NotConfiguredError` if any required CloudTalk env var is missing.
 * Webhook route handlers should pre-check via `isCloudtalkConfigured()` to
 * branch into a "service misconfigured" response rather than letting this
 * throw bubble through.
 */
let _cache: CloudtalkRuntimeConfig | null = null
export function getCloudtalkConfig(): CloudtalkRuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildCloudtalkConfig(env)
  return _cache
}

/**
 * Feature-gate helper. Never throws. Use to:
 *   - Short-circuit webhook routes (return 500 in prod / accept-with-warning in dev)
 *   - Gate UI affordances ("don't show Enroll-in-Campaign if CloudTalk isn't configured")
 *   - Drive the boot banner in server-env
 */
export function isCloudtalkConfigured(): boolean {
  return listMissingCloudtalk().length === 0
}

/**
 * Boot-banner registry entry. server-env iterates the set of registered
 * meta entries after parse and prints one line per service.
 */
export const cloudtalkConfigMeta = {
  service: 'cloudtalk' as const,
  isConfigured: isCloudtalkConfigured,
  listMissing: listMissingCloudtalk,
} as const
