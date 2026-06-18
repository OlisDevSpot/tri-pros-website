import { z } from 'zod'
import { cloudtalkDispositions } from '../constants'

// Cloudtalk Workflow Automation event shapes — corrected 2026-05-31.
//
// Architecture: CT has NO centralized webhook configuration page. Instead,
// each event fires from a separate Workflow Automation (WA) configured under
// Account → Workflow Automations. We construct the body shape ourselves in
// each WA's body-builder UI; CT does NOT inject `event_type` natively — we
// hardcode it as the first body field in every WA.
//
// 5 WAs for Phase 1 (NOT 6 — `call.missed` and `voicemail.received` are
// derived inside the `call.ended` handler from CT's `is_voicemail` flag +
// `answered_at` presence; disposition arrives separately on `Call.Modified`):
//
//   1. Call + Started      → event_type: 'call.started'
//   2. Call + Answered     → event_type: 'call.answered'
//   3. Call + Ended        → event_type: 'call.ended'
//   4. Call + Modified     → event_type: 'call.disposition_set'
//   5. Messages + Received → event_type: 'sms.received'
//
// Race-ordering note: `Call.Ended` typically fires before `Call.Modified`
// (which carries the disposition during after-call work). The route handler
// is idempotent and checks current-status-before-transition.
//
// see ../README.md
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-31
// see docs/plans/voip-campaigns/phase-0-cloudtalk-setup.md (Task 6.2 body builder spec)

const e164Schema = z.string().regex(/^\+?\d{10,15}$/)
const ctTimestampSchema = z.string().min(1)

// CloudTalk emits call direction as 'incoming' / 'outgoing'. Normalize to the
// app-canonical 'inbound' / 'outbound' vocabulary used everywhere else. (Do NOT
// hardcode 'outbound' in the WA body-builder — template the real value:
// `"direction": "{{ event.properties.direction }}"`.)
const ctDirectionSchema = z
  .enum(['incoming', 'outgoing'])
  .transform(d => (d === 'incoming' ? 'inbound' : 'outbound'))

// CloudTalk WA body-builder templates render values as strings. A boolean field
// may arrive as a raw `true` (unquoted token) OR the string `"true"`/`"1"`.
// Coerce both so a stringified boolean doesn't fail the whole event parse.
const ctBooleanSchema = z.preprocess((v) => {
  if (typeof v === 'boolean') {
    return v
  }
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === '1') {
      return true
    }
    if (s === 'false' || s === '0' || s === '') {
      return false
    }
  }
  return v
}, z.boolean())

// CloudTalk WA payloads MUST be FLAT — no nested objects. The matched contact's
// id/name therefore arrive as top-level `contact_id` / `contact_name` fields
// (NOT a nested `contact` object). The id is the deterministic join key into
// `voip_campaign_contacts.cloudtalk_contact_id`.
//
// CT renders a no-match template (`{{ event.properties.contacts[0].id }}` with
// no matched contact) as an empty string. We normalize "" / null → undefined so
// the handler treats it as "unresolvable" (safe no-op) rather than a real id.
// Numeric ids are coerced to string.
const ctContactIdSchema = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : String(v)),
  z.string().optional(),
)

const ctContactNameSchema = z.preprocess(
  v => (v === '' || v === null ? undefined : v),
  z.string().optional(),
)

// ── 1. Call + Started ───────────────────────────────────────────────────────
export const cloudtalkCallStartedSchema = z.object({
  event_type: z.literal('call.started'),
  call_uuid: z.string(),
  caller_e164: e164Schema, // mapped from event.properties.external_number
  internal_number_e164: e164Schema.optional(), // mapped from event.properties.internal_number
  // REQUIRED — CT reliably emits direction on call start; ring-2 attempt
  // counting must trust it (only outbound increments). Normalized incoming→inbound.
  direction: ctDirectionSchema,
  // ALWAYS template the contact id (flat `contact_id` from
  // `{{ event.properties.contacts[0].id }}`) so we can resolve the customer
  // deterministically via the voip_campaign_contacts.cloudtalk_contact_id bridge.
  // Stays optional: an inbound call from a never-enrolled number has no CT
  // contact → "" → undefined → safe no-op.
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
  started_at: ctTimestampSchema,
})

export type CloudtalkCallStartedEvent = z.infer<typeof cloudtalkCallStartedSchema>

// ── 2. Call + Answered ──────────────────────────────────────────────────────
export const cloudtalkCallAnsweredSchema = z.object({
  event_type: z.literal('call.answered'),
  call_uuid: z.string(),
  agent_id: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
  // Always template the contact id for deterministic customer resolution.
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
  answered_at: ctTimestampSchema,
})

export type CloudtalkCallAnsweredEvent = z.infer<typeof cloudtalkCallAnsweredSchema>

// ── 3. Call + Ended ─────────────────────────────────────────────────────────
// v1 (2026-06-17): the handler counts each unique call.ended into
// voip_campaign_contacts.dial_attempts (exactly-once via the last_call_uuid
// dedup) and drives the app-side SMS cadence (see sms-cadence.service.ts).
// `internal_number_e164` is the SMS `from`. Status derivation (completed /
// no_answer / voicemail from `is_voicemail` + `answered_at`) and exhaustion →
// `cadence_exhausted` are deferred to ring 2 — `is_voicemail`/`duration_sec`/
// `recording_url` are carried (optional) but not yet consumed.
export const cloudtalkCallEndedSchema = z.object({
  event_type: z.literal('call.ended'),
  call_uuid: z.string(),
  ended_at: ctTimestampSchema,
  // CT Workflow-Automation bodies template values as strings — coerce. (Mirrors
  // schemas/primitives.ts#ctNumberSchema; events.ts is self-contained by design.)
  duration_sec: z.coerce.number().int().optional(),
  // Normalized incoming→inbound. Optional here (verify the token exists in the
  // Call+Ended WA builder); ring-2 attempt counting reads this to count only
  // outbound dials. Tighten to required once the token is confirmed.
  direction: ctDirectionSchema.optional(),
  // Stringified-boolean safe (see ctBooleanSchema) — CT may emit "true"/"false".
  // Relaxed to optional (2026-06-17): unused by v1 SMS cadence; a missing value
  // must not 400 the whole event. Future voicemail handling will tighten this.
  is_voicemail: ctBooleanSchema.optional(),
  // Our campaign DID for this call — the SMS `from`. Mapped from CT's
  // event.properties.internal_number. Optional: inbound/manual calls may omit it.
  internal_number_e164: e164Schema.optional(),
  // Always template the contact id for deterministic customer resolution.
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
  recording_url: z.string().nullable().optional(),
})

export type CloudtalkCallEndedEvent = z.infer<typeof cloudtalkCallEndedSchema>

// ── 4. Call + Modified (disposition arrives here, NOT on call.ended) ────────
// CT `Call.Modified` may fire for tag/note edits too → handler guards on
// actual disposition delta. The disposition value is one of the 10 locked
// Q5 outcomes (5 manual + 5 system-set).
export const cloudtalkCallDispositionSetSchema = z.object({
  event_type: z.literal('call.disposition_set'),
  call_uuid: z.string(),
  disposition: z.enum(cloudtalkDispositions),
  note: z.string().nullable().optional(),
  // The CT contact this disposition is about — needed for terminal dispositions
  // to resolve our customer (we don't shadow CT calls, so `call_uuid` alone
  // can't map to a customer). The Call.Modified WA body-builder MUST emit the
  // flat `contact_id` here. Optional in the schema so a disposition event
  // without it still parses (handler then can't act → keeps dialing, safe).
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
})

export type CloudtalkCallDispositionSetEvent = z.infer<typeof cloudtalkCallDispositionSetSchema>

// ── 5. Messages + Received ──────────────────────────────────────────────────
// Inbound SMS. Handler STOP-keyword-matches against the text → if STOP,
// mirror to `customers.dncOptedOutAt` via complianceService (CT already
// auto-honors on its side). Otherwise notify last-interacting agent; we do
// NOT persist the SMS row — CT keeps the record (INTEGRATION-SEAM §8).
export const cloudtalkSmsReceivedSchema = z.object({
  event_type: z.literal('sms.received'),
  from_e164: e164Schema,
  to_e164: e164Schema,
  text: z.string(),
  // Always template the contact id. STOP handling resolves contact-id-first then
  // falls back to from_e164 (phone) — a STOP must be honored even from a
  // never-enrolled number that has no CT contact id.
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
  received_at: ctTimestampSchema,
})

export type CloudtalkSmsReceivedEvent = z.infer<typeof cloudtalkSmsReceivedSchema>

// ── Discriminated union (the canonical event shape) ─────────────────────────
export const cloudtalkEventSchema = z.discriminatedUnion('event_type', [
  cloudtalkCallStartedSchema,
  cloudtalkCallAnsweredSchema,
  cloudtalkCallEndedSchema,
  cloudtalkCallDispositionSetSchema,
  cloudtalkSmsReceivedSchema,
])

export type CloudtalkEvent = z.infer<typeof cloudtalkEventSchema>
