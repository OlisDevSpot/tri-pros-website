import type { Pipeline } from '@/shared/constants/enums/pipelines'

interface CustomerPipelineInput {
  meetings: Array<{ projectId: string | null, pipeline: string }>
  projectCount: number
}

export function deriveCustomerPipelines(input: CustomerPipelineInput): Pipeline[] {
  const pipelineSet = new Set<Pipeline>()

  for (const meeting of input.meetings) {
    if (meeting.projectId !== null) {
      pipelineSet.add('projects')
    }
    else {
      pipelineSet.add(meeting.pipeline as Pipeline)
    }
  }

  if (input.projectCount > 0) {
    pipelineSet.add('projects')
  }

  return Array.from(pipelineSet)
}
