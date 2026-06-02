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
// 8-tier pipeline status — 1:1 with CT tag set (see lib/types.ts cloudtalkTagNames).
// 'not_enrolled' is local-only (no CT counterpart). Replaces customers.pipelineStage.
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-28/29 (Q9.F lock)
// see src/shared/services/providers/cloudtalk/webhooks/lifecycle-mapper.ts
export const voipCampaignStatuses = [
  'not_enrolled',
  'lead',
  'engaged',
  'transferred',
  'booked',
  'do_not_call',
  'exhausted',
  'bad_number',
] as const
export type VoipCampaignStatus = (typeof voipCampaignStatuses)[number]
