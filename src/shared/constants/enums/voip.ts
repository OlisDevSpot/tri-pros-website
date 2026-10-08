// voip-in-house (Twilio) is fully separate from voip-campaigns: no `source` discriminator, no dialer-only states, and no DNC-source enum since DNC lives on customers.
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

export const voipDirections = ['outbound', 'inbound'] as const
export type VoipDirection = (typeof voipDirections)[number]

// SMS only — no iMessage values (Sendblue was dropped).
export const voipMessageStatuses = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'received',
] as const
export type VoipMessageStatus = (typeof voipMessageStatuses)[number]

/** Delivery only moves forward: a late `sent` callback must not overwrite `delivered`. */
export const VOIP_MESSAGE_STATUS_RANK: Record<VoipMessageStatus, number> = {
  queued: 0,
  received: 0,
  sent: 1,
  delivered: 2,
  undelivered: 2,
  failed: 2,
}

export const voipLinkTokenTypes = ['l_doc'] as const
export type VoipLinkTokenType = (typeof voipLinkTokenTypes)[number]

// Why a contact left a campaign (our action, not a dialer status):
//   graduated = meeting booked · opted_out = STOP, also writes DNC · disqualified = bad lead, stop calling
//   removed = neutral pull, re-enrollable (not a bad lead, no DNC)
export const voipUnenrollReasons = ['graduated', 'opted_out', 'disqualified', 'removed'] as const
export type VoipUnenrollReason = (typeof voipUnenrollReasons)[number]

// Mirrors the dialer provider's campaign `type`: autodial = single-agent power dialer (default);
// dynamic = multi-agent shared lead pool; predictive = multi-agent predictive (both SalesPro-gated).
export const dialerModes = ['autodial', 'dynamic', 'predictive'] as const
export type DialerMode = (typeof dialerModes)[number]

// Mirrors the provider's campaign run state.
export const voipCampaignStatuses = ['active', 'inactive'] as const
export type VoipCampaignStatus = (typeof voipCampaignStatuses)[number]
