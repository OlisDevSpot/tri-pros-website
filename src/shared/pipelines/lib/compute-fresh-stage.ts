import type { FreshPipelineStage } from '../constants/fresh-pipeline'

interface StageInput {
  hasPastMeeting: boolean
  hasActiveMeeting: boolean
  hasScheduledFutureMeeting: boolean
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

  // Future meeting only = scheduled
  if (data.hasScheduledFutureMeeting) {
    return 'meeting_scheduled'
  }

  return 'needs_confirmation'
}
