// Cross-source discriminator (used by voip_calls, voip_messages, voip_dids).
// 'cloudtalk' rows are populated by voip-campaigns' webhook handler; 'in_house' rows by Twilio webhooks.
export const voipSources = ['in_house', 'cloudtalk'] as const
export type VoipSource = (typeof voipSources)[number]

// Call lifecycle (in-house Twilio call). CloudTalk-originated rows use the same enum;
// 'no_answer' and 'voicemail' are the CloudTalk-side terminals.
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

// Disposition recorded post-call (agent picks via UI; CloudTalk populates via webhook for 'cloudtalk' source).
export const voipCallDispositions = [
  'booked_meeting',
  'callback_scheduled',
  'interested_not_now',
  'not_interested',
  'wrong_number',
  'opt_out',
  'voicemail_left',
  'unreached',
] as const
export type VoipCallDisposition = (typeof voipCallDispositions)[number]

// DID lifecycle. In-house DIDs are typically 'active' (low-volume; no warming cycle).
// CloudTalk DIDs may use 'warming' / 'cooldown' / 'flagged' / 'retired' per voip-campaigns rotation policy.
export const voipDidStatuses = ['active', 'warming', 'cooldown', 'flagged', 'retired'] as const
export type VoipDidStatus = (typeof voipDidStatuses)[number]

// DID role within the in-house pool. Transfer-target receives general inbound (warm-transfer use case removed
// in the 2026-05-27 pivot; endpoint remains scaffolded). Agent-outbound DIDs are sticky per agent
// (assigned_user_id set). Campaign-rotation is voip-campaigns territory.
export const voipDidRoles = ['transfer_target', 'agent_outbound', 'campaign_rotation'] as const
export type VoipDidRole = (typeof voipDidRoles)[number]

// DNC source. Matches INTEGRATION-SEAM.md §5 exactly.
export const voipDncSources = [
  'twilio_stop', // inbound STOP/UNSUB to in-house Twilio DID
  'cloudtalk_stop', // inbound STOP to a CloudTalk DID (CloudTalk auto-honors + posts webhook)
  'voice_request', // customer asked to be removed on a live call
  'manual_admin', // admin clicks "Add to DNC" in admin UI
  'ftc', // FTC DNC list scrub (Phase 2+ cron)
] as const
export type VoipDncSource = (typeof voipDncSources)[number]

// Agent availability for receiving warm transfers.
export const voipUserAvailabilities = ['available', 'on_call', 'off_shift'] as const
export type VoipUserAvailability = (typeof voipUserAvailabilities)[number]

// Transfer mode for receiving warm transfers. 'mobile' (cellular) is Phase 3; Phase 1 ships 'desktop' only.
// 'auto' resolves to desktop if browser softphone registered, else mobile (Phase 3 behavior).
export const voipTransferModes = ['desktop', 'mobile', 'auto'] as const
export type VoipTransferMode = (typeof voipTransferModes)[number]

// Message direction.
export const voipMessageDirections = ['outbound', 'inbound'] as const
export type VoipMessageDirection = (typeof voipMessageDirections)[number]

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

// Tokenized-link type. L-DOC is Phase 1; others land per use case.
export const voipLinkTokenTypes = ['l_doc', 'l_pay', 'l_cal', 'l_esign'] as const
export type VoipLinkTokenType = (typeof voipLinkTokenTypes)[number]
