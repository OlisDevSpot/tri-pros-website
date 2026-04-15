import type { PipelineConfig, PipelineStageConfig } from '../types'

import { CalendarIcon, PhoneIcon, UserCheckIcon } from 'lucide-react'

export const rehashPipelineStages = [
  'schedule_manager_meeting',
  'made_contact',
  'meeting_scheduled',
] as const

export type RehashPipelineStage = (typeof rehashPipelineStages)[number]

export const rehashStageConfig: readonly PipelineStageConfig<RehashPipelineStage>[] = [
  { key: 'schedule_manager_meeting', label: 'Schedule Manager Meeting', icon: CalendarIcon, color: 'blue' },
  { key: 'made_contact', label: 'Made Contact', icon: PhoneIcon, color: 'yellow' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', icon: UserCheckIcon, color: 'green' },
]

export const REHASH_ALLOWED_DRAG_TRANSITIONS: Record<RehashPipelineStage, readonly RehashPipelineStage[]> = {
  schedule_manager_meeting: ['made_contact'],
  made_contact: ['meeting_scheduled'],
  meeting_scheduled: [],
}

export const REHASH_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}

export const rehashPipelineConfig: PipelineConfig<RehashPipelineStage> = {
  stages: rehashPipelineStages,
  stageConfig: rehashStageConfig,
  allowedTransitions: REHASH_ALLOWED_DRAG_TRANSITIONS,
  blockedMessages: REHASH_BLOCKED_MESSAGES,
}
