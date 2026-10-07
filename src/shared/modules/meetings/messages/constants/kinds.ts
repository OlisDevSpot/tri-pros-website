export const meetingMessageKinds = [
  'visit_summary',
  'day_before_reminder',
  'rep_confirmation',
  'confirmation_reply',
  'visit_cancellation',
  'homeowner_reply',
] as const
export type MeetingMessageKind = (typeof meetingMessageKinds)[number]

export const meetingMessageChannels = ['sms', 'email'] as const
export type MeetingMessageChannel = (typeof meetingMessageChannels)[number]

/** `received` is a homeowner reply; the rest describe something Tri Pros sent or chose not to. */
export const meetingMessageStatuses = ['pending', 'sent', 'failed', 'skipped', 'received'] as const
export type MeetingMessageStatus = (typeof meetingMessageStatuses)[number]

/** The order a meeting's texts go in. The confirmation reply and the visit cancellation are reactions, not steps. */
export const VISIT_MESSAGE_SEQUENCE = ['visit_summary', 'day_before_reminder', 'rep_confirmation'] as const satisfies readonly MeetingMessageKind[]
export type VisitMessageSequenceKind = (typeof VISIT_MESSAGE_SEQUENCE)[number]

/** The automatic kinds. Only these can be paused or skipped. */
export const pausableVisitMessageKinds = ['day_before_reminder', 'rep_confirmation'] as const satisfies readonly MeetingMessageKind[]
export type PausableVisitMessageKind = (typeof pausableVisitMessageKinds)[number]

export const visitMessageSkipReasons = ['booked_after_noon', 'paused', 'no_phone', 'dnc', 'manual'] as const
export type VisitMessageSkipReason = (typeof visitMessageSkipReasons)[number]

/** One per wording a super-admin can edit. The day-before reminder has two, by whether the homeowner confirmed. */
export const visitMessageTemplateKeys = [
  'visit_summary',
  'day_before_reminder_unconfirmed',
  'day_before_reminder_confirmed',
  'rep_confirmation',
  'confirmation_reply',
] as const
export type VisitMessageTemplateKey = (typeof visitMessageTemplateKeys)[number]
