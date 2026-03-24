'use client'

import type { ColumnFiltersState, FilterFnOption, SortingState, VisibilityState } from '@tanstack/react-table'
import type { DataTableProps, DataTableTimePresetFilter } from '@/shared/components/data-table/types'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'

import { createDateRangeFilterFn } from '@/shared/components/data-table/lib/filter-fns'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface Props<TData, TMeta = unknown> extends DataTableProps<TData, TMeta> {
  onActiveRowChange?: (id: string | null) => void
}

export function DataTable<TData extends { id: string }, TMeta = unknown>({
  data,
  columns,
  meta,
  filterConfig,
  defaultSort,
  pageSize = 15,
  entityName = 'row',
  rowDataAttribute = 'data-table-row',
  onActiveRowChange,
  onRowClick,
  onFilteredCountChange,
  onFilteredDataChange,
}: Props<TData, TMeta>) {
  const isMobile = useIsMobile()
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>(defaultSort ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Auto-hide columns with meta.hidden
  const columnVisibility = useMemo<VisibilityState>(() => {
    const visibility: VisibilityState = {}
    for (const col of columns) {
      const key = 'accessorKey' in col ? col.accessorKey as string : undefined
      if (key && (col.meta as { hidden?: boolean } | undefined)?.hidden) {
        visibility[key] = false
      }
    }
    return visibility
  }, [columns])

  // Auto-register dateRange filterFns for any time-preset filters in config
  const timePresetFilters = useMemo(
    () => (filterConfig?.filter((f): f is DataTableTimePresetFilter => f.type === 'time-preset') ?? []),
    [filterConfig],
  )

  const filterFns = useMemo(() => {
    const fns: Record<string, ReturnType<typeof createDateRangeFilterFn<TData>>> = {}
    for (const f of timePresetFilters) {
      fns[`dateRange_${f.columnId}`] = createDateRangeFilterFn<TData>(f.presets)
    }
    return fns
  }, [timePresetFilters])

  // Patch columns to inject filterFn on time-preset columns
  const patchedColumns = useMemo(() => {
    if (timePresetFilters.length === 0) {
      return columns
    }

    const timeColumnIds = new Set(timePresetFilters.map(f => f.columnId))

    return columns.map((col) => {
      const accessorKey = 'accessorKey' in col ? col.accessorKey as string : undefined
      if (accessorKey && timeColumnIds.has(accessorKey)) {
        return { ...col, filterFn: `dateRange_${accessorKey}` as FilterFnOption<TData> }
      }
      return col
    })
  }, [columns, timePresetFilters])

  // Notify parent of active row changes
  useEffect(() => {
    onActiveRowChange?.(activeRowId)
  }, [activeRowId, onActiveRowChange])

  // Mobile: dismiss when the user taps anywhere outside a table row
  useEffect(() => {
    if (!activeRowId) {
      return
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest(`[${rowDataAttribute}]`)) {
        return
      }
      setActiveRowId(null)
    }

    const timerId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timerId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [activeRowId, rowDataAttribute])

  const table = useReactTable({
    data,
    columns: patchedColumns,
    filterFns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    meta: {
      ...meta,
      activeRowId,
    } as TMeta & { activeRowId: string | null },
  })

  // Notify parent of filtered row changes
  const filteredRows = table.getFilteredRowModel().rows
  const filteredCount = filteredRows.length
  useEffect(() => {
    onFilteredCountChange?.(filteredCount)
  }, [filteredCount, onFilteredCountChange])

  useEffect(() => {
    onFilteredDataChange?.(filteredRows.map(r => r.original))
  }, [filteredRows, onFilteredDataChange])

  return (
    <div className="flex flex-col h-full gap-4">
      {filterConfig && filterConfig.length > 0 && (
        <div className="shrink-0">
          <DataTableFilterBar table={table} filters={filterConfig} />
        </div>
      )}

      <div className="grow min-h-0 overflow-y-auto">
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map((row) => {
                    const rowProps: Record<string, unknown> = { [rowDataAttribute]: true }

                    return (
                      <TableRow
                        key={row.id}
                        className="group cursor-pointer border-border/50"
                        onClick={() => {
                          if (onRowClick) {
                            onRowClick(row.original)
                          }
                          else if (isMobile) {
                            setActiveRowId(prev => prev === row.original.id ? null : row.original.id)
                          }
                        }}
                        {...rowProps}
                      >
                        {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No
                        {' '}
                        {entityName}
                        s match your filter.
                      </TableCell>
                    </TableRow>
                  )}
            </TableBody>
          </Table>
        </div>

        <div className="py-4">
          <DataTablePagination table={table} />
        </div>
      </div>
    </div>
  )
}
