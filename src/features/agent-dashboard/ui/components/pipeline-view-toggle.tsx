'use client'

import { KanbanIcon, TableIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

export type PipelineLayout = 'kanban' | 'table'

interface Props {
  value: PipelineLayout
  onChange: (value: PipelineLayout) => void
  className?: string
}

export function PipelineViewToggle({ value, onChange, className }: Props) {
  return (
    <ToggleGroup
      className={cn('', className)}
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        if (v) {
          onChange(v as PipelineLayout)
        }
      }}
    >
      <ToggleGroupItem value="kanban" aria-label="Kanban view">
        <KanbanIcon className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label="Table view">
        <TableIcon className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
