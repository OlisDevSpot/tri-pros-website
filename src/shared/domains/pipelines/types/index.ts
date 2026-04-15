import type { LucideIcon } from 'lucide-react'

export interface PipelineStageConfig<TStage extends string = string> {
  key: TStage
  label: string
  icon: LucideIcon
  color: string
}

export interface PipelineConfig<TStage extends string = string> {
  stages: readonly TStage[]
  stageConfig: readonly PipelineStageConfig<TStage>[]
  allowedTransitions: Record<string, readonly string[]>
  blockedMessages: Record<string, string>
}
