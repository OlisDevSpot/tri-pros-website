import type {
  freshMeetingStages,
  freshProposalStages,
  leadsPipelineStages,
  meetingPipelines,
  pipelines,
  projectPipelineStages,
  projectStatuses,
} from '@/shared/constants/enums/pipelines'

export type FreshMeetingStage = (typeof freshMeetingStages)[number]
export type FreshProposalStage = (typeof freshProposalStages)[number]
export type LeadsPipelineStage = (typeof leadsPipelineStages)[number]
export type MeetingPipeline = (typeof meetingPipelines)[number]
export type Pipeline = (typeof pipelines)[number]
export type ProjectPipelineStage = (typeof projectPipelineStages)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
