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

// Provider-level pilot DID env vars — exposed as a typed grouping so service
// layers don't have to know individual env var names. Slug C's voip-dids
// service will read this to seed/sync the `voip_dids` table.
export const PILOT_DIDS = {
  transferTarget: {
    e164: serverEnv.TWILIO_TRANSFER_TARGET_DID_E164,
    sid: serverEnv.TWILIO_TRANSFER_TARGET_DID_SID,
  },
  did424: {
    e164: serverEnv.TWILIO_DID_424_E164,
    sid: serverEnv.TWILIO_DID_424_SID,
  },
  did626: {
    e164: serverEnv.TWILIO_DID_626_E164,
    sid: serverEnv.TWILIO_DID_626_SID,
  },
} as const

// Vetting-clock env vars (optional; Phase 0 still pending). Exposed so callers
// can guard outbound capabilities behind their availability without re-reading
// process.env. The voip-messages service will refuse outbound SMS in production
// when TWILIO_10DLC_CAMPAIGN_SID is unset.
export const VETTING = {
  trustProfileSid: serverEnv.TWILIO_TRUST_PROFILE_SID,
  tenDlcCampaignSid: serverEnv.TWILIO_10DLC_CAMPAIGN_SID,
} as const

// Dev-only outbound redirect. When set in dev/preview, services route every
// outbound call/SMS to this single number. server-env.ts already enforces
// "must NOT be set in production" via runtime gate.
export const VOIP_DEV_OVERRIDE_NUMBER = serverEnv.VOIP_DEV_OVERRIDE_NUMBER
