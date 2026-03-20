'use client'

import { CalendarDaysIcon, KanbanIcon, TableIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

export type DataViewType = 'kanban' | 'table' | 'calendar'

const VIEW_CONFIG: Record<DataViewType, { icon: typeof KanbanIcon, label: string }> = {
  kanban: { icon: KanbanIcon, label: 'Kanban view' },
  table: { icon: TableIcon, label: 'Table view' },
  calendar: { icon: CalendarDaysIcon, label: 'Calendar view' },
}

interface Props {
  value: DataViewType
  onChange: (value: DataViewType) => void
  availableViews?: DataViewType[]
  className?: string
}

export function DataViewTypeToggle({
  value,
  onChange,
  availableViews = ['kanban', 'table'],
  className,
}: Props) {
  return (
    <ToggleGroup
      className={cn('', className)}
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        if (v) {
          onChange(v as DataViewType)
        }
      }}
    >
      {availableViews.map((view) => {
        const config = VIEW_CONFIG[view]
        return (
          <ToggleGroupItem key={view} value={view} aria-label={config.label}>
            <config.icon className="h-4 w-4" />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
