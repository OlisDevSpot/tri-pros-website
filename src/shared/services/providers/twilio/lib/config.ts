import env from '@/shared/config/server-env'

interface TwilioRuntimeConfig {
  accountSid: string
  authToken: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
}

let cached: TwilioRuntimeConfig | null = null

/**
 * Resolve and validate the Twilio runtime config.
 *
 * `server-env.ts` keeps the underlying TWILIO_* vars optional so a Vercel
 * boot without voip configured still succeeds (commit `da028029`). This
 * helper is the single seam where "module-level optional" narrows to
 * "method-level required" — every twilioClient call site reads through
 * `getTwilioConfig()` and gets `string`, not `string | undefined`.
 *
 * Failure mode: throws ONCE with every missing var listed at the call
 * site that needs them — not as a cryptic `undefined is not assignable`
 * downstream, nor a Twilio-side 401 surprise in prod.
 *
 * Mirror this pattern in any other provider whose env vars are optional
 * at the schema layer but structurally required at the provider's call
 * sites (e.g., cloudtalk's `CLOUDTALK_WEBHOOK_SECRET`).
 */
export function getTwilioConfig(): TwilioRuntimeConfig {
  if (cached) {
    return cached
  }

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

  cached = {
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    apiKeySid: env.TWILIO_API_KEY_SID!,
    apiKeySecret: env.TWILIO_API_KEY_SECRET!,
    twimlAppSid: env.TWILIO_TWIML_APP_SID!,
  }
  return cached
}
