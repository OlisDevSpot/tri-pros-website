'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'

interface Props {
  value: Pipeline
  onChange: (value: Pipeline) => void
}

export function PipelineSelect({ value, onChange }: Props) {
  const ability = useAbility()
  const accessiblePipelines = getAccessiblePipelines(ability)

  return (
    <Select value={value} onValueChange={v => onChange(v as Pipeline)}>
      <SelectTrigger className="w-35">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accessiblePipelines.map(key => (
          <SelectItem key={key} value={key}>{PIPELINE_LABELS[key]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
