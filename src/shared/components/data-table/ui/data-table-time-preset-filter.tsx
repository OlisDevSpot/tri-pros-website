'use client'

/**
 * @deprecated Use the `date-range` filter type with `<QueryToolbar>` for
 * server-side date filtering. See PR #151 cleanup checklist.
 */

import type { Table } from '@tanstack/react-table'
import type { DataTableTimePresetFilter as TimePresetFilterConfig } from '@/shared/components/data-table/types'

import { CalendarDays, Check, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

interface Props<TData> {
  filter: TimePresetFilterConfig
  table: Table<TData>
}

export function DataTableTimePresetFilter<TData>({ filter, table }: Props<TData>) {
  const [open, setOpen] = useState(false)
  const currentValue = (table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''
  const activePreset = filter.presets.find(p => p.value === currentValue)

  function handleSelect(value: string) {
    const next = value === currentValue ? '' : value
    table.getColumn(filter.columnId)?.setFilterValue(next || undefined)
    setOpen(false)
  }

  function handleClear() {
    table.getColumn(filter.columnId)?.setFilterValue(undefined)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 text-xs font-normal',
            activePreset && 'border-primary/50 bg-primary/5 text-primary',
          )}
        >
          <CalendarDays className="size-3.5" />
          <span>{activePreset ? `${filter.label}: ${activePreset.label}` : filter.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        <div className="flex flex-col">
          {filter.presets.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleSelect(preset.value)}
              className={cn(
                'flex items-center justify-between rounded-sm px-2.5 py-1.5 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                preset.value === currentValue && 'bg-accent font-medium',
              )}
            >
              <span>{preset.label}</span>
              {preset.value === currentValue && (
                <Check className="size-3.5 text-primary" />
              )}
            </button>
          ))}

          {activePreset && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
              >
                <X className="size-3" />
                <span>Clear filter</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
