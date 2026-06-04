import { z } from 'zod'

import { NotConfiguredError } from '@/shared/config/not-configured-error'
import env from '@/shared/config/server-env'

/**
 * Twilio env var schema fragment + runtime-config builder + accessor.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Why this file owns ALL of Twilio's env story (not just the fragment):
 * server-env imports `twilioEnvFragment` to spread into the central schema,
 * and that's the ONLY thing it imports. Consumers (twilioClient, services,
 * routes) `import { getTwilioConfig } from '...twilio/lib/config'` — one
 * import surface per provider (mirrors `client-is-the-superset-entry-point`).
 *
 * ESM bootstrap order: server-env imports this file for the fragment; this
 * file imports `env` from server-env. Safe because every `env` read here
 * is inside a function body, not at module scope — by the time getXConfig()
 * or isXConfigured() is called, server-env has finished parsing.
 */
export const twilioEnvFragment = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_TWIML_APP_SID: z.string().optional(),
  TWILIO_TRUST_PROFILE_SID: z.string().optional(), // Trust Hub vetting clock; optional until issued
  TWILIO_10DLC_CAMPAIGN_SID: z.string().optional(), // 10DLC vetting clock; optional until approval
})

export type ParsedTwilioEnv = z.infer<typeof twilioEnvFragment>

export interface TwilioRuntimeConfig {
  accountSid: string
  authToken: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
}

/**
 * Required env keys for Twilio's runtime to operate. Excludes vetting-clock
 * vars (`TWILIO_TRUST_PROFILE_SID`, `TWILIO_10DLC_CAMPAIGN_SID`) which ride
 * along on the schema for visibility but aren't structurally required by
 * the SDK or webhook validation paths.
 */
const REQUIRED_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_TWIML_APP_SID',
] as const satisfies ReadonlyArray<keyof ParsedTwilioEnv>

function listMissingTwilio(): string[] {
  return REQUIRED_KEYS.filter(k => !env[k])
}

/**
 * Narrow the parsed env (Twilio fields as `string | undefined`) into a
 * runtime config (every required field as `string`). Throws once with all
 * missing vars listed if any are unset.
 *
 * Pure function — does not read process.env. Use `getTwilioConfig()` for
 * the cached, env-bound accessor.
 */
export function buildTwilioConfig(parsed: ParsedTwilioEnv): TwilioRuntimeConfig {
  const missing = REQUIRED_KEYS.filter(k => !parsed[k])
  if (missing.length > 0) {
    throw new NotConfiguredError('twilio', missing)
  }
  return {
    accountSid: parsed.TWILIO_ACCOUNT_SID!,
    authToken: parsed.TWILIO_AUTH_TOKEN!,
    apiKeySid: parsed.TWILIO_API_KEY_SID!,
    apiKeySecret: parsed.TWILIO_API_KEY_SECRET!,
    twimlAppSid: parsed.TWILIO_TWIML_APP_SID!,
  }
}

/**
 * Cached accessor — the public entry point for every consumer that needs
 * Twilio config. Lazy: doesn't read env until first call.
 *
 * Throws `NotConfiguredError` if any required Twilio env var is missing —
 * tRPC error formatters / route handlers can `instanceof` to translate
 * into a structured "service unavailable" response.
 */
let _cache: TwilioRuntimeConfig | null = null
export function getTwilioConfig(): TwilioRuntimeConfig {
  if (_cache) {
    return _cache
  }
  _cache = buildTwilioConfig(env)
  return _cache
}

/**
 * Feature-gate helper. Never throws. Use to short-circuit UI affordances
 * ("don't show the Call button if Twilio isn't configured") and to drive
 * the boot banner in server-env.
 */
export function isTwilioConfigured(): boolean {
  return listMissingTwilio().length === 0
}

/**
 * Boot-banner registry entry. server-env iterates the set of provider
 * `<x>ConfigMeta` entries after parse and prints one line per service.
 */
export const twilioConfigMeta = {
  service: 'twilio' as const,
  isConfigured: isTwilioConfigured,
  listMissing: listMissingTwilio,
} as const
