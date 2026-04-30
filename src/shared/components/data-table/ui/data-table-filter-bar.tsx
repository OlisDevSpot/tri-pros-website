'use client'

import type { Table } from '@tanstack/react-table'
import type { DataTableFilterConfig, DataTableMultiSelectFilter, DataTableSelectFilter } from '@/shared/components/data-table/types'

import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DataTableTimePresetFilter } from '@/shared/components/data-table/ui/data-table-time-preset-filter'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/shared/components/ui/multi-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useIsMobile } from '@/shared/hooks/use-mobile'

/**
 * @deprecated Use `<QueryToolbar>` from `@/shared/components/query-toolbar/ui/query-toolbar`
 * for new server-paginated tables. This bar is kept for legacy client-side tables that
 * still consume `DataTableFilterConfig` (Activities, Past Meetings, Past Proposals,
 * Projects portfolio, Customer Pipelines). See PR #151 cleanup checklist.
 */
interface Props<TData> {
  table: Table<TData>
  filters: DataTableFilterConfig[]
}

function DebouncedSearchInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setLocalValue(next)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      onChange(next)
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // Sync from external resets (e.g. filter cleared programmatically)
  if (value !== localValue && timerRef.current === null) {
    setLocalValue(value)
  }

  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      className={className}
    />
  )
}

function SelectFilter<TData>({ filter, table }: { filter: DataTableSelectFilter, table: Table<TData> }) {
  const currentValue = (table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''

  return (
    <Select
      value={currentValue}
      onValueChange={(value) => {
        table.getColumn(filter.columnId)?.setFilterValue(value === 'all' ? '' : value)
      }}
    >
      <SelectTrigger className="w-full md:w-40">
        <SelectValue placeholder={filter.placeholder ?? filter.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {filter.options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MultiSelectFilterControl<TData>({ filter, table }: { filter: DataTableMultiSelectFilter, table: Table<TData> }) {
  const currentValue = (table.getColumn(filter.columnId)?.getFilterValue() as string[]) ?? []

  return (
    <MultiSelect
      values={currentValue}
      onValuesChange={(values) => {
        table.getColumn(filter.columnId)?.setFilterValue(values.length > 0 ? values : undefined)
      }}
    >
      <MultiSelectTrigger className="w-full md:w-56">
        <MultiSelectValue placeholder={filter.placeholder ?? filter.label} />
      </MultiSelectTrigger>
      <MultiSelectContent search={{ placeholder: `Search ${filter.label.toLowerCase()}...` }}>
        <MultiSelectGroup>
          {filter.options.map(option => (
            <MultiSelectItem key={option.value} value={option.value}>
              {option.label}
            </MultiSelectItem>
          ))}
        </MultiSelectGroup>
      </MultiSelectContent>
    </MultiSelect>
  )
}

export function DataTableFilterBar<TData>({ table, filters }: Props<TData>) {
  const isMobile = useIsMobile()

  const searchFilters = filters.filter((f): f is Extract<DataTableFilterConfig, { type: 'search' }> => f.type === 'search')
  const selectFilters = filters.filter((f): f is DataTableSelectFilter => f.type === 'select')
  const multiSelectFilters = filters.filter((f): f is DataTableMultiSelectFilter => f.type === 'multi-select')
  const timePresetFilters = filters.filter((f): f is Extract<DataTableFilterConfig, { type: 'time-preset' }> => f.type === 'time-preset')

  const activeSelectFilterCount = selectFilters.filter((f) => {
    const value = (table.getColumn(f.columnId)?.getFilterValue() as string) ?? ''
    return value !== ''
  }).length

  const activeMultiSelectFilterCount = multiSelectFilters.filter((f) => {
    const value = table.getColumn(f.columnId)?.getFilterValue() as string[] | undefined
    return value && value.length > 0
  }).length

  const activeSelectCount = activeSelectFilterCount + activeMultiSelectFilterCount

  return (
    <div className="flex items-center gap-3">
      {searchFilters.map(filter => (
        <DebouncedSearchInput
          key={filter.id}
          placeholder={filter.placeholder ?? 'Filter...'}
          value={(table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''}
          onChange={v => table.getColumn(filter.columnId)?.setFilterValue(v)}
          className="max-w-72 flex-1 md:flex-none"
        />
      ))}

      {timePresetFilters.map(filter => (
        <DataTableTimePresetFilter key={filter.id} filter={filter} table={table} />
      ))}

      {isMobile && (selectFilters.length > 0 || multiSelectFilters.length > 0)
        ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0">
                  <SlidersHorizontal className="size-4" />
                  {activeSelectCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {activeSelectCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-3 p-3">
                <p className="text-xs font-medium text-muted-foreground">Filters</p>
                {selectFilters.map(filter => (
                  <div key={filter.id} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{filter.label}</label>
                    <SelectFilter filter={filter} table={table} />
                  </div>
                ))}
                {multiSelectFilters.map(filter => (
                  <div key={filter.id} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{filter.label}</label>
                    <MultiSelectFilterControl filter={filter} table={table} />
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )
        : (
            <>
              {selectFilters.map(filter => (
                <SelectFilter key={filter.id} filter={filter} table={table} />
              ))}
              {multiSelectFilters.map(filter => (
                <MultiSelectFilterControl key={filter.id} filter={filter} table={table} />
              ))}
            </>
          )}
    </div>
  )
}
