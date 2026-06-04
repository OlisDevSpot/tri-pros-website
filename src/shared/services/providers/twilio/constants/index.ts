import serverEnv from '@/shared/config/server-env'

// Default TTL for AccessToken JWTs minted for the browser softphone.
// 1 hour matches Twilio's recommended default. The Voice JS SDK fires
// `tokenWillExpire` ~30s before this; the softphone UI re-fetches.
export const ACCESS_TOKEN_TTL_SECONDS = 3600 as const

// Identity claim prefix on AccessTokens. The browser softphone passes a
// user id as the identity; we prepend an env-scoped prefix so that a single
// Twilio account hosting both dev + prod softphones can disambiguate registrations.
// (Slug C / softphone work will plumb this through; provider only declares the constant.)
export const ACCESS_TOKEN_IDENTITY_PREFIX
  = serverEnv.NODE_ENV === 'production' ? 'prod' : 'dev'

// Inbound voice greeting voice. Polly.Joanna-Neural is Twilio's higher-quality
// neural voice that doesn't require additional vendor wiring.
export const INBOUND_VOICE_TTS_VOICE = 'Polly.Joanna-Neural' as const

// PILOT_DIDS removed 2026-06-04 — DID source of truth is now the `voip_dids`
// table. Services resolve DIDs via DAL queries (getStickyDidForUser,
// getDidByE164, getDidByProviderId). Admin "Resync from Twilio" populates +
// reconciles the table via voipDidsService.resyncFromTwilio.

// Vetting-clock env vars (optional; Phase 0 still pending). Exposed so callers
// can guard outbound capabilities behind their availability without re-reading
// process.env. The voip-messages service will refuse outbound SMS in production
// when TWILIO_10DLC_CAMPAIGN_SID is unset.
//
// Lazy getter (NOT a module-scope const) per `provider-env-config-when-optional`
// — both fields are .optional() on the schema, so a module-scope read would
// capture `undefined` permanently and downstream "is vetting complete?" checks
// would be stale if env were hot-swapped. (It isn't, but consistency.)
export function getVetting(): { trustProfileSid: string | undefined, tenDlcCampaignSid: string | undefined } {
  return {
    trustProfileSid: serverEnv.TWILIO_TRUST_PROFILE_SID,
    tenDlcCampaignSid: serverEnv.TWILIO_10DLC_CAMPAIGN_SID,
  }
}

// Dev-only outbound redirect. When set in dev/preview, services route every
// outbound call/SMS to this single number. server-env.ts already enforces
// "must NOT be set in production" via runtime gate.
export const VOIP_DEV_OVERRIDE_NUMBER = serverEnv.VOIP_DEV_OVERRIDE_NUMBER
