'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { cn } from '@/shared/lib/utils'

type PipelineScope = 'all' | Pipeline

interface Props {
  value: PipelineScope
  onChange: (value: PipelineScope) => void
  activePipeline: Pipeline
  className?: string
}

export function PipelineScopeToggle({ value, onChange, activePipeline, className }: Props) {
  const isScoped = value !== 'all'
  const pipelineLabel = PIPELINE_LABELS[activePipeline]

  return (
    <div className={cn('flex items-center gap-2 rounded-full bg-card px-3 py-1.5 border', className)}>
      <Switch
        id="pipeline-scope"
        checked={isScoped}
        onCheckedChange={(checked) => {
          onChange(checked ? activePipeline : 'all')
        }}
      />
      <Label htmlFor="pipeline-scope" className="relative cursor-pointer select-none text-xs font-medium">
        {/* Invisible text reserves the wider label's width */}
        <span className="invisible">{pipelineLabel.length > 3 ? pipelineLabel : 'All'}</span>
        <span className="absolute inset-0 flex items-center">
          {isScoped ? pipelineLabel : 'All'}
        </span>
      </Label>
    </div>
  )
}

export type { PipelineScope }
