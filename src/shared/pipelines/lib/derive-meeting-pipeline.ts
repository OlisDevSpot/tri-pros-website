import type { MeetingPipeline, Pipeline } from '@/shared/types/enums/pipelines'

interface MeetingPipelineInput {
  projectId: string | null
  pipeline: MeetingPipeline
}

export function deriveMeetingPipeline(meeting: MeetingPipelineInput): Pipeline {
  if (meeting.projectId !== null) {
    return 'projects'
  }
  return meeting.pipeline
}
