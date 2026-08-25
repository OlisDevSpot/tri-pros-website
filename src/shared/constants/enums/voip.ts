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

// ── voip-campaigns (JustCall dialer) ────────────────────────────────────────
// The JustCall auto-dialer owns the lead-to-appointment lifecycle (dialing + its
// own dispositions). On a `meeting_booked` disposition the lead hands off to the
// normal app flow (meeting creation → existing derived customer pipeline).
// voip-campaigns persistence: the provider identity bridges (voip_campaigns,
// voip_contact_fields), the per-customer participation record
// (voip_campaign_contacts — enrollment + dial attempts + provider identity +
// sync), and the shared DNC fields on customers. NO voipCampaign* fields on
// customers. A truthful campaign run-state lives on voip_campaigns.status
// (voipCampaignStatuses below — reinstated for the JustCall migration; the
// former enum + pgEnum + lifecycle-mapper.ts were deleted 2026-06-04 under the
// earlier CloudTalk perfect-separation model).

// WHY a contact left a campaign — recorded on voip_campaign_contacts.unenroll_reason
// when we unenroll. Attribution of OUR action (not a CT lifecycle status):
//   - graduated:    meeting booked (positive exit). app meeting-create OR JustCall meeting_booked.
//   - opted_out:    STOP/opt-out (compliance). Also writes DNC.
//   - disqualified: manual "stop calling / bad lead, no meeting". UI button OR JustCall
//                   not_interested/wrong_number disposition.
//   - removed:      neutral manual unenroll — pulled from the campaign with the
//                   intent to re-enroll later / into a different campaign. NOT a
//                   bad lead (≠ disqualified), NO DNC (≠ opted_out). Re-enrollable.
// Not a pgEnum (kept lightweight as a typed text column); add a pgEnum only if it grows.
export const voipUnenrollReasons = ['graduated', 'opted_out', 'disqualified', 'removed'] as const
export type VoipUnenrollReason = (typeof voipUnenrollReasons)[number]

// Per-campaign dialer mode (JustCall migration 2026-08-19). Mirrors the dialer
// provider's campaign `type`:
//   - autodial:   single-agent power dialer (JustCall Pro). Default.
//   - dynamic:    multi-agent shared lead pool (SalesPro-gated; Bina's source).
//   - predictive: multi-agent predictive (SalesPro-gated).
// The neutral DialerProvider contract declares a structurally-identical
// `DialerMode`; this is the canonical DB/enum home. Not a pgEnum (typed text
// column) — add a pgEnum only if it grows.
export const dialerModes = ['autodial', 'dynamic', 'predictive'] as const
export type DialerMode = (typeof dialerModes)[number]

// Provider-mirrored campaign run state on voip_campaigns.status. Reinstated for
// the JustCall migration (the former `voipCampaignStatuses` enum was deleted
// 2026-06-04 under perfect-separation; the reshape re-adds a truthful `status`
// column). Not a pgEnum (typed text column).
export const voipCampaignStatuses = ['active', 'inactive'] as const
export type VoipCampaignStatus = (typeof voipCampaignStatuses)[number]
