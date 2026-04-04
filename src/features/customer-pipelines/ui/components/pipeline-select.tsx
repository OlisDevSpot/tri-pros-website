'use client'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { PIPELINE_LABELS } from '@/shared/pipelines/constants/pipeline-registry'

interface Props {
  value: Pipeline
  onChange: (value: Pipeline) => void
}

export function PipelineSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={v => onChange(v as Pipeline)}>
      <SelectTrigger className="w-35">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map(key => (
          <SelectItem key={key} value={key}>{PIPELINE_LABELS[key]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
