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
