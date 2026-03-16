import type { LucideIcon } from 'lucide-react'

export interface KanbanItem {
  id: string
  stage: string
}

export interface KanbanStageConfig<S extends string = string> {
  key: S
  label: string
  icon: LucideIcon
  color: string
}

export interface KanbanColumnFilterConfig {
  /** Stage keys that are visible by default. If omitted, all stages are visible. */
  defaultVisible?: string[]
  /** Stage keys that cannot be hidden (checkbox disabled). */
  alwaysVisible?: string[]
}
