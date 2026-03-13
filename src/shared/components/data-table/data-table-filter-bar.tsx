'use client'

import type { Table } from '@tanstack/react-table'
import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props<TData> {
  table: Table<TData>
  filters: DataTableFilterConfig[]
  entityName?: string
}

export function DataTableFilterBar<TData>({ table, filters, entityName = 'row' }: Props<TData>) {
  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <Input
              key={filter.id}
              placeholder={filter.placeholder ?? `Filter ${entityName}s...`}
              value={(table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn(filter.columnId)?.setFilterValue(e.target.value)}
              className="max-w-72"
            />
          )
        }

        if (filter.type === 'select' && filter.options) {
          const currentValue = (table.getColumn(filter.columnId)?.getFilterValue() as string) ?? ''

          return (
            <Select
              key={filter.id}
              value={currentValue}
              onValueChange={(value) => {
                table.getColumn(filter.columnId)?.setFilterValue(value === 'all' ? '' : value)
              }}
            >
              <SelectTrigger className="w-40">
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

        return null
      })}

      <span className="text-sm text-muted-foreground ml-auto">
        {filteredCount}
        {' '}
        {entityName}
        {filteredCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
