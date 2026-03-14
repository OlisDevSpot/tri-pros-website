'use client'

import type { Table } from '@tanstack/react-table'
import type { DataTableTimePresetFilter as TimePresetFilterConfig } from '@/shared/components/data-table/types'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props<TData> {
  filter: TimePresetFilterConfig
  table: Table<TData>
}

export function DataTableTimePresetFilter<TData>({ filter, table }: Props<TData>) {
  const currentValue = (table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''

  return (
    <ToggleGroup
      type="single"
      value={currentValue}
      onValueChange={(value) => {
        table.getColumn(filter.columnId)?.setFilterValue(value || undefined)
      }}
      variant="outline"
      size="sm"
      className="w-full md:w-auto"
    >
      {filter.presets.map(preset => (
        <ToggleGroupItem
          key={preset.value}
          value={preset.value}
          aria-label={`Filter by ${preset.label}`}
          className="flex-1 md:flex-none px-3 text-xs"
        >
          {preset.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
