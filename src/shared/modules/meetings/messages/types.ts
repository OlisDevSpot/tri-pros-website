import type { HomeownerConfirmation, MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'
import type {
  MeetingMessageChannel,
  MeetingMessageKind,
  MeetingMessageStatus,
  PausableVisitMessageKind,
  VisitMessageSequenceKind,
  VisitMessageSkipReason,
} from '@/shared/modules/meetings/messages/constants/kinds'

/** The part of a visit message the rules read. A `meeting_messages` row satisfies it. */
export interface VisitMessageFact {
  kind: MeetingMessageKind
  channel: MeetingMessageChannel
  status: MeetingMessageStatus
  reason: string | null
  forScheduledFor: string
  createdAt: string
}

export interface VisitMessageVars {
  firstName: string
  /** null when no specialist is assigned yet. */
  specialistName: string | null
  /** null when the setter is nobody or the company itself; the texts then speak as the company. */
  coordinatorName: string | null
  visitDate: string
  visitTime: string
  arrivalWindow: string
  visitLink: string
  coordinatorNote: string
}

export type VisitMessageStepState
  = | 'sent'
    | 'failed'
    | 'sending'
    | 'skipped'
    | 'not_applicable'
    | 'scheduled'
    | 'due'
    | 'not_sent'

export interface VisitMessageStep {
  kind: VisitMessageSequenceKind
  /** ISO instant; null for the visit summary, which a person sends. */
  plannedFor: string | null
  state: VisitMessageStepState
  reason: string | null
  /** Set on a scheduled or due step when the run will record a skip instead of sending. */
  skipReason: VisitMessageSkipReason | null
  late: boolean
  variant: 'confirmed' | 'unconfirmed' | null
  row: VisitMessageFact | null
}

export interface VisitMessagePlanInput {
  meeting: {
    scheduledFor: string
    /** When scheduledFor was last set; a time moved after a run's instant is never that run's business. */
    scheduledForSetAt: string
    meetingType: MeetingType
    meetingOutcome: MeetingOutcome
    confirmedAt: string | null
    homeownerConfirmedAt: string | null
    /** False when the owner is the system account. */
    hasRep: boolean
  }
  /** Every visit message in the meeting's reschedule chain. */
  messages: readonly VisitMessageFact[]
  contact: { hasPhone: boolean, doNotContact: boolean }
  pausedKinds: readonly PausableVisitMessageKind[]
  now: Date
}

export interface ConfirmationTrack {
  office: { done: boolean, nudge: 'summary_not_sent' | 'time_changed' | null }
  homeowner: { done: boolean, via: HomeownerConfirmation | 'office' | null }
  rep: { done: boolean }
}
