import type { ZodError } from 'zod'

import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

import z from 'zod'

import { cloudtalkConfigMeta, cloudtalkEnvFragment } from '@/shared/services/providers/cloudtalk/lib/config'
import { notionConfigMeta, notionEnvFragment } from '@/shared/services/providers/notion/lib/config'
import { pipedriveConfigMeta, pipedriveEnvFragment } from '@/shared/services/providers/pipedrive/lib/config'
import { r2ConfigMeta, r2EnvFragment } from '@/shared/services/providers/r2/lib/config'
import { resendConfigMeta, resendEnvFragment } from '@/shared/services/providers/resend/lib/config'
import { twilioConfigMeta, twilioEnvFragment } from '@/shared/services/providers/twilio/lib/config'
import { ablyConfigMeta, ablyEnvFragment, qstashConfigMeta, qstashEnvFragment } from '@/shared/services/providers/upstash/lib/config'

// Load .env.local first (dispatch worktree overrides), then .env as fallback.
// dotenv won't overwrite already-set vars, so .env.local wins.
config({ path: '.env.local' })
expand(config({ path: '.env' }))

// Per-provider env var fragments. Each provider defines its own env-var
// shape + runtime-config builder in its `lib/config.ts`; this file spreads
// those fragments into the central schema and re-exports cached getters so
// consumers always import config from one place.
// see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional

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

  // RESEND — fragment lives at providers/resend/lib/config.ts
  ...resendEnvFragment.shape,

  // MONDAY
  MONDAY_API_TOKEN: z.string(),

  // PIPEDRIVE — fragment lives at providers/pipedrive/lib/config.ts
  // (PIPEDRIVE_BASE_URL removed 2026-06-05 — was dead env, no consumers)
  ...pipedriveEnvFragment.shape,

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

  // NOTION — fragment lives at providers/notion/lib/config.ts
  ...notionEnvFragment.shape,

  // CLOUDFLARE R2 — fragment lives at providers/r2/lib/config.ts
  // (R2_TOKEN + R2_JURISDICTION removed 2026-06-05 — were dead env, no consumers)
  ...r2EnvFragment.shape,

  // UPSTASH QSTASH — fragment lives at providers/upstash/lib/config.ts
  // (QSTASH_URL removed 2026-06-05 — was dead env, qstash-client hardcodes baseUrl)
  ...qstashEnvFragment.shape,
  // UPSTASH REDIS — consumed inline by routers via `new Ratelimit({ url, token })`;
  // NOT routed through a provider directory. Backlog item: consolidate into
  // providers/upstash-redis/ (or similar) to align with the convention.
  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  // BINA (GoHighLevel webhook)
  BINA_WEBHOOK_SECRET: z.string().optional(),

  // ABLY — fragment lives at providers/upstash/lib/config.ts (TODO backlog:
  // move to providers/ably/ — see upstash/lib/config.ts header note)
  ...ablyEnvFragment.shape,

  // VOIP — shared between voip-in-house (Twilio) and voip-campaigns (CloudTalk).
  // See docs/plans/voip/INTEGRATION-SEAM.md + .env.voip.example.
  //
  // All VoIP env vars in this section (VOIP_*, TWILIO_*, CLOUDTALK_*) are
  // OPTIONAL during schema validation — same precedent as the VAPID block below.
  // The consuming code (Twilio client factories, CloudTalk webhook receivers)
  // asserts non-null at the point of use. Build environments without VoIP
  // credentials (CI, prod-before-VoIP-launches, fresh dev clones) parse the
  // schema cleanly; only environments actively using VoIP features need them.
  VOIP_WEBHOOK_BASE_URL: z.string().optional(),
  // (CLOUDTALK_PHASE0_TRANSFER_TARGET_E164 removed 2026-05-27 — AI VoiceAgent off the table per pivot; no transfer mock needed.)
  // Dev safety: redirects all outbound voice/SMS to a single test number in dev/preview.
  // CI gate at bottom of this file prevents this being set in production.
  VOIP_DEV_OVERRIDE_NUMBER: z.string().optional(),

  // TWILIO (voip-in-house) — schema fragment lives at
  // `src/shared/services/providers/twilio/lib/config.ts` and is spread in
  // here. Runtime narrowing happens via the `getTwilioConfig()` accessor,
  // imported by consumers DIRECTLY from the provider's lib/config — NOT
  // re-exported from this file. server-env's role is bootstrap orchestration
  // (schema spread + parse + boot banner + production gates).
  // see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
  ...twilioEnvFragment.shape,

  // Pilot DID env vars removed 2026-06-04 — DID source of truth is now the
  // `voip_dids` table, populated by `voipDidsService.resyncFromTwilio` (admin
  // mutation that reads the live Twilio account). Services resolve DIDs via
  // DAL queries (getStickyDidForUser, getDidByE164, getDidByProviderId).

  // FCC DNC (SAN pending issuance — optional until Phase 0 completes)
  FTC_DNC_SAN: z.string().optional(),
  FTC_DNC_USERNAME: z.string().optional(),
  FTC_DNC_PASSWORD: z.string().optional(),

  // CLOUDTALK (voip-campaigns) — schema fragment lives at
  // `src/shared/services/providers/cloudtalk/lib/config.ts` and is spread
  // in here. Runtime narrowing happens via `getCloudtalkConfig()`, imported
  // by consumers directly from the provider's lib/config.
  // see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
  ...cloudtalkEnvFragment.shape,

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

// Production safety gate: VOIP_DEV_OVERRIDE_NUMBER reroutes all outbound voice/SMS
// to a single test number — invaluable in dev/preview, catastrophic in production.
if (env.NODE_ENV === 'production' && env.VOIP_DEV_OVERRIDE_NUMBER) {
  throw new Error('VOIP_DEV_OVERRIDE_NUMBER must NOT be set in production')
}

// -----------------------------------------------------------------------------
// Boot banner — dev-only configured-service report.
// -----------------------------------------------------------------------------
// Each provider / domain-shared config exports a `<x>ConfigMeta` object from
// its `lib/config.ts`. server-env aggregates them here, queries each
// `listMissing()`, and prints one line per service. Surfaces "twilio is up
// but cloudtalk isn't" at boot rather than hidden behind a runtime error
// the first time a feature is exercised.
//
// Production omits the banner (clean logs); the typed runtime checks from
// `NotConfiguredError` still kick in if a misconfigured service is called.
//
// To register a newly-migrated provider: add its `<x>ConfigMeta` import at
// the top of this file and append to `PROVIDER_METAS` below.
// see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional

const PROVIDER_METAS = [
  twilioConfigMeta,
  cloudtalkConfigMeta,
  resendConfigMeta,
  notionConfigMeta,
  pipedriveConfigMeta,
  r2ConfigMeta,
  qstashConfigMeta,
  ablyConfigMeta,
] as const

if (env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.log('[server-env] Configured services:')
  for (const meta of PROVIDER_METAS) {
    const missing = meta.listMissing()
    // eslint-disable-next-line no-console
    console.log(
      missing.length === 0
        ? `  ✅ ${meta.service}`
        : `  ❌ ${meta.service}  missing: ${missing.join(', ')}`,
    )
  }
}

export default env
