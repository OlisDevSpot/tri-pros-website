import type { ZodError } from 'zod'

import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

import z from 'zod'

// Load .env.local first (dispatch worktree overrides), then .env as fallback.
// dotenv won't overwrite already-set vars, so .env.local wins.
config({ path: '.env.local' })
expand(config({ path: '.env' }))

const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_BASE_URL: z.string(),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_DEV_URL: z.string().optional(),

  // Better Auth
  BETTER_AUTH_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string(),

  // Tunnel (dev — public HTTPS URL for webhooks)
  NGROK_URL: z.string().optional(),

  // GOOGLE
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // RESEND
  RESEND_API_KEY: z.string(),

  // MONDAY
  MONDAY_API_TOKEN: z.string(),

  // PIPEDRIVE
  PIPEDRIVE_BASE_URL: z.string(),
  PIPEDRIVE_API_KEY: z.string(),

  // ZOHO SIGN
  ZOHO_SIGN_DEV_TOKEN: z.string().optional(),
  ZOHO_SIGN_CLIENT_ID: z.string().optional(),
  ZOHO_SIGN_CLIENT_SECRET: z.string().optional(),
  ZOHO_SIGN_REFRESH_TOKEN: z.string().optional(),
  ZOHO_SIGN_WEBHOOK_SECRET: z.string().optional(),

  // QUICKBOOKS
  QB_CLIENT_ID: z.string(),
  QB_CLIENT_SECRET: z.string(),
  QB_REDIRECT_URI: z.string(),
  QB_WEBHOOK_VERIFIER_TOKEN: z.string(),

  // NOTION
  NOTION_API_KEY: z.string(),

  // CLOUDFLARE R2
  R2_ACCOUNT_ID: z.string(),
  R2_TOKEN: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_JURISDICTION: z.string(),

  // UPSTASH
  QSTASH_URL: z.string(),
  QSTASH_TOKEN: z.string(),
  QSTASH_CURRENT_SIGNING_KEY: z.string(),
  QSTASH_NEXT_SIGNING_KEY: z.string(),
  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  // BINA (GoHighLevel webhook)
  BINA_WEBHOOK_SECRET: z.string().optional(),

  // ABLY
  ABLY_API_KEY: z.string(),

  // VOIP — shared between voip-in-house (Twilio) and voip-campaigns (CloudTalk).
  // See docs/plans/voip/INTEGRATION-SEAM.md + .env.voip.example.
  VOIP_WEBHOOK_BASE_URL: z.string().optional(),
  // Phase 0 only — mocked transfer-target endpoint returns this E.164 for the smoke test.
  // Replaced in Phase 1 with the real Twilio in-house DID lookup. Leave empty in prod.
  CLOUDTALK_PHASE0_TRANSFER_TARGET_E164: z.string().optional(),

  // CLOUDTALK (voip-campaigns)
  // HTTP Basic auth — Access Key ID is the username, Access Key Secret is the password.
  CLOUDTALK_ACCESS_KEY_ID: z.string().optional(),
  CLOUDTALK_ACCESS_KEY_SECRET: z.string().optional(),
  // Long-random shared secret appended as ?secret=<value> on the webhook URL configured in CloudTalk dashboard.
  CLOUDTALK_WEBHOOK_SECRET: z.string().optional(),
  // Optional comma-separated CIDRs for Vercel edge allowlist.
  CLOUDTALK_WEBHOOK_IP_ALLOWLIST: z.string().optional(),

  // WEB PUSH (VAPID)
  // Generate with `node scripts/generate-vapid-keys.mjs`. The public key is
  // exposed to the client via NEXT_PUBLIC_*; the private key signs JWT auth
  // headers to push services and must stay server-only. The subject is a
  // contact URL/email Apple/Google can reach you at if the keys misbehave.
  // ALL three are optional so existing dev environments don't fail validation
  // — push features no-op gracefully when missing.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
})

export type env = z.infer<typeof envSchema>

// eslint-disable-next-line import/no-mutable-exports, ts/no-redeclare
let env: env

try {
  // eslint-disable-next-line node/prefer-global/process
  env = envSchema.parse(process.env)
}
catch (e) {
  const error = e as ZodError
  console.error('❌ Invalid environment variables:')
  console.error(z.flattenError(error).fieldErrors)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}

export default env
