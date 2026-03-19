'use client'

import type { CustomerPipeline } from '@/shared/types/enums'

import { PIPELINE_LABELS } from '@/features/customer-pipelines/constants/pipeline-labels'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props {
  value: CustomerPipeline
  onChange: (value: CustomerPipeline) => void
}

export function PipelineSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={v => onChange(v as CustomerPipeline)}>
      <SelectTrigger className="w-[140px]">
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
