import type { FreshPipelineStage } from '../constants/fresh-pipeline'
import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

interface StageInput {
  /** The earliest undecided meeting that is upcoming or started within the last two hours. */
  liveMeeting: { started: boolean, confirmed: boolean } | null
  /** The outcome of the customer's latest meeting by scheduled time. */
  latestOutcome: MeetingOutcome | null
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

  // The next visit decides the stage; earlier meetings, recorded or not, never hide whether it is confirmed.
  if (data.liveMeeting) {
    if (data.liveMeeting.started) {
      return 'meeting_in_progress'
    }
    return data.liveMeeting.confirmed ? 'meeting_confirmed' : 'needs_confirmation'
  }

  if (data.latestOutcome === 'reschedule_needed') {
    return 'reschedule'
  }

  // A follow-up is owed and not booked yet; once booked, it is the live meeting above.
  if (data.latestOutcome === 'follow_up_needed') {
    return 'follow_up_scheduled'
  }

  return 'meeting_completed'
}
