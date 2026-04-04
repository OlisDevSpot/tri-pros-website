import type { PipelineConfig, PipelineStageConfig } from '../types'

import {
  CheckCircle2Icon,
  CheckSquareIcon,
  ClipboardListIcon,
  FileSignatureIcon,
  HammerIcon,
} from 'lucide-react'

import { projectPipelineStages } from '@/shared/constants/enums/pipelines'

export type ProjectsPipelineStage = (typeof projectPipelineStages)[number]

export const projectsStageConfig: readonly PipelineStageConfig<ProjectsPipelineStage>[] = [
  { key: 'signed', label: 'Signed', icon: FileSignatureIcon, color: 'green' },
  { key: 'permits_pending', label: 'Permits Pending', icon: ClipboardListIcon, color: 'orange' },
  { key: 'in_progress', label: 'In Progress', icon: HammerIcon, color: 'blue' },
  { key: 'punch_list', label: 'Punch List', icon: CheckSquareIcon, color: 'yellow' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2Icon, color: 'green' },
]

export const PROJECTS_ALLOWED_DRAG_TRANSITIONS: Record<ProjectsPipelineStage, readonly ProjectsPipelineStage[]> = {
  signed: ['permits_pending'],
  permits_pending: ['in_progress'],
  in_progress: ['punch_list'],
  punch_list: ['completed'],
  completed: [],
}

export const PROJECTS_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}

export const projectsPipelineConfig: PipelineConfig<ProjectsPipelineStage> = {
  stages: projectPipelineStages,
  stageConfig: projectsStageConfig,
  allowedTransitions: PROJECTS_ALLOWED_DRAG_TRANSITIONS,
  blockedMessages: PROJECTS_BLOCKED_MESSAGES,
}
