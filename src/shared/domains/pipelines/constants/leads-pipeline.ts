import type { PipelineConfig, PipelineStageConfig } from '../types'

import {
  CalendarCheckIcon,
  InboxIcon,
  PhoneIcon,
  UserCheckIcon,
} from 'lucide-react'

import { leadsPipelineStages } from '@/shared/constants/enums/pipelines'

export type LeadsPipelineStage = (typeof leadsPipelineStages)[number]

export const leadsStageConfig: readonly PipelineStageConfig<LeadsPipelineStage>[] = [
  { key: 'new', label: 'New', icon: InboxIcon, color: 'blue' },
  { key: 'contacted', label: 'Contacted', icon: PhoneIcon, color: 'yellow' },
  { key: 'qualified', label: 'Qualified', icon: UserCheckIcon, color: 'purple' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', icon: CalendarCheckIcon, color: 'green' },
]

// Allow free bidirectional drag between all stages
const allStages = [...leadsPipelineStages]
export const LEADS_ALLOWED_DRAG_TRANSITIONS = Object.fromEntries(
  allStages.map(stage => [stage, allStages.filter(s => s !== stage)]),
) as unknown as Record<LeadsPipelineStage, readonly LeadsPipelineStage[]>

export const LEADS_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}

export const leadsPipelineConfig: PipelineConfig<LeadsPipelineStage> = {
  stages: leadsPipelineStages,
  stageConfig: leadsStageConfig,
  allowedTransitions: LEADS_ALLOWED_DRAG_TRANSITIONS,
  blockedMessages: LEADS_BLOCKED_MESSAGES,
}
