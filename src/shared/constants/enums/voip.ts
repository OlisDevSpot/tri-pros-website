// ── voip-in-house (Twilio) ──────────────────────────────────────────────────
// Phase 1 ships 4 enums total. See docs/plans/voip-in-house/phase-1-mvp.md
// GRILL RESULTS (2026-05-30) for the reduction rationale (total separation
// from voip-campaigns ⇒ no `source` discriminator, no CT-only states,
// no warm-transfer infra, no DNC-source enum since DNC lives on customers).

// Call lifecycle (in-house Twilio call only).
export const voipCallStatuses = [
  'queued',
  'initiated',
  'ringing',
  'answered',
  'completed',
  'no_answer',
  'voicemail',
  'failed',
  'skipped_compliance',
] as const
export type VoipCallStatus = (typeof voipCallStatuses)[number]

// Direction — used by both voip_calls and voip_messages.
// Renamed from voipMessageDirections per 2026-05-30 grill.
export const voipDirections = ['outbound', 'inbound'] as const
export type VoipDirection = (typeof voipDirections)[number]

// Message status. SMS only — no iMessage values (Sendblue dropped permanently).
export const voipMessageStatuses = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'received',
] as const
export type VoipMessageStatus = (typeof voipMessageStatuses)[number]

// Tokenized-link type. Phase 1 ships only `l_doc`; others land per use case
// (narrowed from 4 → 1 per 2026-05-30 grill — YAGNI).
export const voipLinkTokenTypes = ['l_doc'] as const
export type VoipLinkTokenType = (typeof voipLinkTokenTypes)[number]

// ── voip-campaigns (CloudTalk) ──────────────────────────────────────────────
// NO local campaign-status enum. Under the perfect-separation decision
// (voip-in-house EPIC.md "2026-05-30 total separation" + confirmed 2026-06-04),
// CloudTalk is the sole source of truth for the lead-to-appointment lifecycle,
// INCLUDING its own pipeline tags. We never compute, store, or push a campaign
// status — on a `meeting_booked` disposition CT hands the lead off to the normal
// app flow (meeting creation → existing derived customer pipeline). The only
// voip-campaigns persistence is the CT identity bridges (voip_campaigns,
// voip_contact_attributes), the per-customer participation record
// (voip_campaign_contacts — enrollment + dial attempts + CT identity + sync),
// and the shared DNC fields on customers. NO voipCampaign* fields on customers.
// (Former `voipCampaignStatuses` enum + `voipCampaignStatusEnum` pgEnum +
// lifecycle-mapper.ts deleted 2026-06-04.)

// WHY a contact left a campaign — recorded on voip_campaign_contacts.unenroll_reason
// when we unenroll. Attribution of OUR action (not a CT lifecycle status):
//   - graduated:    meeting booked (positive exit). app meeting-create OR CT meeting_booked.
//   - opted_out:    STOP/opt-out (compliance). Also writes DNC.
//   - disqualified: manual "stop calling / bad lead, no meeting". UI button OR CT
//                   not_interested/wrong_number disposition.
//   - removed:      neutral manual unenroll — pulled from the campaign with the
//                   intent to re-enroll later / into a different campaign. NOT a
//                   bad lead (≠ disqualified), NO DNC (≠ opted_out). Re-enrollable.
// Not a pgEnum (kept lightweight as a typed text column); add a pgEnum only if it grows.
export const voipUnenrollReasons = ['graduated', 'opted_out', 'disqualified', 'removed'] as const
export type VoipUnenrollReason = (typeof voipUnenrollReasons)[number]
