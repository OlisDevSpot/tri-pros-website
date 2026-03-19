import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import { SkullIcon, XCircleIcon } from 'lucide-react'

export const deadPipelineStages = [
  'mostly_dead',
  'really_dead',
] as const

export type DeadPipelineStage = (typeof deadPipelineStages)[number]

export const deadStageConfig: readonly KanbanStageConfig<DeadPipelineStage>[] = [
  { key: 'mostly_dead', label: 'Mostly Dead', icon: SkullIcon, color: 'yellow' },
  { key: 'really_dead', label: 'Really Dead', icon: XCircleIcon, color: 'red' },
]

export const DEAD_ALLOWED_DRAG_TRANSITIONS: Record<DeadPipelineStage, readonly DeadPipelineStage[]> = {
  mostly_dead: ['really_dead'],
  really_dead: [],
}

export const DEAD_BLOCKED_MESSAGES: Record<string, string> = {
  default: 'This transition is not supported via drag',
}
