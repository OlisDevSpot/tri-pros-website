import type { MeetingPipelineStage, ProposalPipelineStage } from '@/features/agent-dashboard/constants/pipeline-stages'
import type { MeetingPipelineItem, ProposalPipelineItem } from '@/features/agent-dashboard/dal/server/get-pipeline-items'

import { meetingPipelineStages, proposalPipelineStages } from '@/features/agent-dashboard/constants/pipeline-stages'

export function groupMeetingsByStage(
  items: MeetingPipelineItem[],
): Record<MeetingPipelineStage, MeetingPipelineItem[]> {
  const grouped = Object.fromEntries(
    meetingPipelineStages.map(stage => [stage, [] as MeetingPipelineItem[]]),
  ) as Record<MeetingPipelineStage, MeetingPipelineItem[]>

  for (const item of items) {
    if (item.stage in grouped) {
      grouped[item.stage].push(item)
    }
  }

  return grouped
}

export function groupProposalsByStage(
  items: ProposalPipelineItem[],
): Record<ProposalPipelineStage, ProposalPipelineItem[]> {
  const grouped = Object.fromEntries(
    proposalPipelineStages.map(stage => [stage, [] as ProposalPipelineItem[]]),
  ) as Record<ProposalPipelineStage, ProposalPipelineItem[]>

  for (const item of items) {
    if (item.stage in grouped) {
      grouped[item.stage].push(item)
    }
  }

  return grouped
}
