import type { PipelineConfig, PipelineStageConfig } from '../types'

import {
  BanIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileSignatureIcon,
  FolderOpenIcon,
  HammerIcon,
  PauseCircleIcon,
  SearchCheckIcon,
  WalletIcon,
} from 'lucide-react'

import { projectPipelineStages } from '@/shared/constants/enums/pipelines'

export type ProjectsPipelineStage = (typeof projectPipelineStages)[number]

export const projectsStageConfig: readonly PipelineStageConfig<ProjectsPipelineStage>[] = [
  { key: 'signed', label: 'Signed', icon: FileSignatureIcon, color: 'green' },
  { key: 'opened', label: 'Opened', icon: FolderOpenIcon, color: 'blue' },
  { key: 'pending_inspection', label: 'Pending Inspection', icon: ClipboardListIcon, color: 'orange' },
  { key: 'install_complete', label: 'Install Complete', icon: HammerIcon, color: 'blue' },
  { key: 'pending_final_inspection', label: 'Pending Final Inspection', icon: SearchCheckIcon, color: 'orange' },
  { key: 'passed_final', label: 'Passed Final', icon: ClipboardCheckIcon, color: 'green' },
  { key: 'got_partial_payment', label: 'Got Partial Payment', icon: CircleDollarSignIcon, color: 'yellow' },
  { key: 'got_full_payment', label: 'Got Full Payment', icon: WalletIcon, color: 'green' },
  { key: 'closed', label: 'Closed', icon: CheckCircle2Icon, color: 'green' },
  { key: 'cancelled', label: 'Cancelled', icon: BanIcon, color: 'red' },
  { key: 'on_hold', label: 'On Hold', icon: PauseCircleIcon, color: 'yellow' },
]

// Allow free bidirectional drag between all stages
const allStages = [...projectPipelineStages]
export const PROJECTS_ALLOWED_DRAG_TRANSITIONS = Object.fromEntries(
  allStages.map(stage => [stage, allStages.filter(s => s !== stage)]),
) as unknown as Record<ProjectsPipelineStage, readonly ProjectsPipelineStage[]>

export const PROJECTS_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}

export const projectsPipelineConfig: PipelineConfig<ProjectsPipelineStage> = {
  stages: projectPipelineStages,
  stageConfig: projectsStageConfig,
  allowedTransitions: PROJECTS_ALLOWED_DRAG_TRANSITIONS,
  blockedMessages: PROJECTS_BLOCKED_MESSAGES,
}
