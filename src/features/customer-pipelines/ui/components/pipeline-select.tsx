'use client'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { PIPELINE_LABELS } from '@/features/customer-pipelines/constants/pipeline-labels'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

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
        {Object.entries(PIPELINE_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
