import type { FreshPipelineStage } from '../constants/fresh-pipeline'

interface StageInput {
  hasPastMeeting: boolean
  hasActiveMeeting: boolean
  hasScheduledFutureMeeting: boolean
  /** An upcoming meeting on this customer was confirmed with the homeowner. */
  hasConfirmedFutureMeeting: boolean
  /** A meeting on this customer was dispositioned `follow_up_needed`. */
  hasFollowUpNeeded: boolean
  /** A meeting on this customer was dispositioned `reschedule_needed`. */
  hasRescheduleNeeded: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
}

export function computeFreshStage(data: StageInput): FreshPipelineStage {
  const { proposalStatuses } = data

  if (proposalStatuses.includes('approved')) {
    return 'approved'
  }

  if (data.hasSentContract) {
    return 'contract_sent'
  }

  if (proposalStatuses.includes('sent')) {
    return 'proposal_sent'
  }

  if (proposalStatuses.length > 0 && proposalStatuses.every(s => s === 'declined')) {
    return 'declined'
  }

  // Explicit `reschedule_needed` outcome → Reschedule stage.
  if (data.hasRescheduleNeeded) {
    return 'reschedule'
  }

  // Explicit `follow_up_needed` outcome → Follow-up stage, even before any
  // follow-up meeting is booked. (A booked follow-up also lands here below.)
  if (data.hasFollowUpNeeded) {
    return 'follow_up_scheduled'
  }

  // Past meeting + future meeting = follow-up scheduled
  if (data.hasPastMeeting && data.hasScheduledFutureMeeting) {
    return 'follow_up_scheduled'
  }

  // Active meeting (within 2h window of scheduledFor) = in progress
  if (data.hasActiveMeeting) {
    return 'meeting_in_progress'
  }

  // Only past meetings, nothing upcoming = done
  if (data.hasPastMeeting) {
    return 'meeting_completed'
  }

  // Confirmation is soft: a confirmed meeting can still be rescheduled or
  // cancelled, which the outcome checks above already take precedence over.
  if (data.hasConfirmedFutureMeeting) {
    return 'meeting_confirmed'
  }

  // Every booked meeting waits here until someone confirms it.
  return 'needs_confirmation'
}
