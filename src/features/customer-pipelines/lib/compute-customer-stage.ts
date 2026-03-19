import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'

interface StageInput {
  hasCompletedMeeting: boolean
  hasInProgressMeeting: boolean
  hasScheduledFutureMeeting: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
}

export function computeCustomerStage(data: StageInput): CustomerPipelineStage {
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

  if (data.hasCompletedMeeting && data.hasInProgressMeeting) {
    return 'follow_up_scheduled'
  }

  if (data.hasCompletedMeeting && !data.hasInProgressMeeting) {
    return 'meeting_completed'
  }

  if (data.hasInProgressMeeting && !data.hasScheduledFutureMeeting) {
    return 'meeting_in_progress'
  }

  return 'meeting_scheduled'
}
