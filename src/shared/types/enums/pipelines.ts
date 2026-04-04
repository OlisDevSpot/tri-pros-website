import type { leadsPipelineStages, meetingPipelines, pipelines, projectPipelineStages, projectStatuses } from '@/shared/constants/enums/pipelines'

export type LeadsPipelineStage = (typeof leadsPipelineStages)[number]
export type MeetingPipeline = (typeof meetingPipelines)[number]
export type Pipeline = (typeof pipelines)[number]
export type ProjectPipelineStage = (typeof projectPipelineStages)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
