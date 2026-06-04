import { z } from 'zod'

/**
 * Twilio env var schema fragment + runtime-config builder.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 *
 * Why this file exists: the underlying TWILIO_* vars are `.optional()` at
 * the schema layer (commit `da028029`) so a Vercel boot without voip
 * configured still parses cleanly. Consumers need them as `string`, not
 * `string | undefined`. This file is the single seam where the narrowing
 * happens — and it is the *definition*, not the import path. The
 * aggregated parsed env + the cached `getTwilioConfig()` accessor live
 * in `@/shared/config/server-env`, which spreads `twilioEnvFragment`
 * into the central schema and re-exports a getter. Consumers always
 * import from server-env.
 *
 * Mirror this pattern in any other provider whose env vars are optional
 * at the schema layer but structurally required when used.
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
 * Narrow the parsed env (with TWILIO_* as `string | undefined`) into a
 * runtime config (with every required field as `string`), throwing once
 * with all missing vars listed if any are unset.
 *
 * Pure function. Called by the cached `getTwilioConfig()` accessor in
 * server-env.ts; do not call directly from consumer code.
 *
 * Note: `TWILIO_TRUST_PROFILE_SID` and `TWILIO_10DLC_CAMPAIGN_SID` are
 * intentionally excluded from `TwilioRuntimeConfig` — they ride along
 * in the schema for vetting-clock visibility but the runtime client
 * doesn't structurally require them.
 */
export function buildTwilioConfig(env: ParsedTwilioEnv): TwilioRuntimeConfig {
  const missing: string[] = []
  if (!env.TWILIO_ACCOUNT_SID) {
    missing.push('TWILIO_ACCOUNT_SID')
  }
  if (!env.TWILIO_AUTH_TOKEN) {
    missing.push('TWILIO_AUTH_TOKEN')
  }
  if (!env.TWILIO_API_KEY_SID) {
    missing.push('TWILIO_API_KEY_SID')
  }
  if (!env.TWILIO_API_KEY_SECRET) {
    missing.push('TWILIO_API_KEY_SECRET')
  }
  if (!env.TWILIO_TWIML_APP_SID) {
    missing.push('TWILIO_TWIML_APP_SID')
  }

  if (missing.length > 0) {
    throw new Error(
      `Twilio is not configured for this environment. Missing env vars: ${missing.join(', ')}. `
      + `Set them in Vercel or .env.local to enable Twilio-backed voip features.`,
    )
  }

  return {
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    apiKeySid: env.TWILIO_API_KEY_SID!,
    apiKeySecret: env.TWILIO_API_KEY_SECRET!,
    twimlAppSid: env.TWILIO_TWIML_APP_SID!,
  }
}
