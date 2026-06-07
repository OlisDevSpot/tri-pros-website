// Provider-level constants. Combines pricing (cost-tracking widget input),
// domain enums (tag names, dispositions, attribute keys), and HTTP wiring
// (base URLs). One file per twilio's pattern — callers grab what they need
// from a single import.
//
// see ../README.md for provider conventions
// see docs/plans/voip-campaigns/EPIC.md decisions log

// ── HTTP hosts ──────────────────────────────────────────────────────────────
// CueCard / VoiceAgent endpoints use a different host (`platform-api.cloudtalk.io`).
// Default host (`my.cloudtalk.io/api`) handles every Phase 1 endpoint.
export const CLOUDTALK_HOSTS = {
  default: 'https://my.cloudtalk.io/api',
  platform: 'https://platform-api.cloudtalk.io/api',
} as const

export type CloudtalkHost = keyof typeof CLOUDTALK_HOSTS

// ── Rate-limit defense ──────────────────────────────────────────────────────
// CT documents 60 req/min/account. The client warns when remaining ≤ this
// threshold so admins notice budget pressure before we hit 429s.
export const CLOUDTALK_RATE_LIMIT_WARN_THRESHOLD = 5 as const

// Max retry attempts when CT returns 429. Each retry uses the
// `X-CloudTalkAPI-ResetTime` hint plus a small jitter.
export const CLOUDTALK_MAX_RETRIES = 3 as const

// ── Bulk cap (per /bulk/contacts.json contract) ─────────────────────────────
export const CLOUDTALK_BULK_MAX_OPS_PER_REQUEST = 10 as const

// ── CloudTalk lifecycle tag vocabulary ──────────────────────────────────────
// These 7 names are CloudTalk's OWN pipeline tags, applied + swapped by
// CloudTalk as the lead progresses. Under perfect separation (confirmed
// 2026-06-04) CloudTalk is the sole source of truth for lifecycle — we do NOT
// push these tags and we do NOT mirror them to a local status enum (the former
// `voipCampaignStatus` enum was deleted 2026-06-04). This array is retained
// only as the read-side vocabulary for parsing CT webhook tag-sets and for
// reconciliation reads.
//
// Membership tags (`Campaign-MetaAds`, `Campaign-HomeDepot`, …) are a SEPARATE
// concern: each campaign filters by ONE membership tag, and `addTags` with that
// tag IS enrollment (the one tag write we DO perform). Membership tag names are
// per-source, synced into `voip_campaigns.ct_membership_tag` — not hardcoded
// here.
//
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-28/29
export const cloudtalkTagNames = [
  'Lead',
  'Engaged',
  'Transferred',
  'Booked',
  'DoNotCall',
  'Exhausted',
  'BadNumber',
] as const

export type CloudtalkTagName = (typeof cloudtalkTagNames)[number]

// ── Dispositions surfaced via webhook payloads ──────────────────────────────
// Q5 lock — 10 dispositions: 5 manual, 5 system-set.
// `cadence_exhausted` is APP-SIDE (we emit it when our attempt counter hits
// voip_campaigns.attempts_per_contact); CT does not fire an exhausted webhook.
export const cloudtalkDispositions = [
  // Manual (agent picks in CT softphone after-call work)
  'not_interested',
  'callback_scheduled',
  'meeting_booked',
  'wrong_number',
  'opt_out',
  // System-set (CT or our webhook handler infers)
  'no_answer',
  'busy',
  'voicemail',
  'cadence_exhausted',
  'sms_stop_received',
] as const

export type CloudtalkDisposition = (typeof cloudtalkDispositions)[number]

// ── Custom contact attribute keys ───────────────────────────────────────────
// 3 custom attributes per 2026-05-31 lock (built-in `name` + `city` use CT's
// first-class Contact fields, NOT custom attributes).
// `voip_contact_attributes.app_key` constrained to these literals.
export const cloudtalkContactAttributeAppKeys = [
  'lead_source',
  'primary_trade',
  'trades_interested',
] as const

export type CloudtalkContactAttributeAppKey
  = (typeof cloudtalkContactAttributeAppKeys)[number]

// ── Pricing (admin cost-tracking widget input) ──────────────────────────────
// Source: CloudTalk public pricing page, snapshot 2026-05-30.
// Update when CT republishes; the W8 widget reads this directly.
// All amounts USD. Outbound voice is per-minute (rounded up by CT).
// SMS is per-segment for US local DIDs.
export const cloudtalkPricing = {
  perMinuteOutbound: 0.018,
  perMinuteInbound: 0.014,
  // SMS — US local DIDs (segment cost). A2P 10DLC fees billed separately by carrier.
  perSmsSegmentUs: 0.0095,
  // DID monthly rental — included in plan up to N; overage cost.
  perDidMonthly: 6,
  // Plan flat (per-user, monthly) — informational only; not added to consumption math.
  perUserMonthlyExpert: 50,
} as const

export type CloudtalkPricing = typeof cloudtalkPricing
