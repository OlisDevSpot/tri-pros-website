'use client'

import type { ColumnFiltersState, SortingState } from '@tanstack/react-table'
import type { DataTableProps } from '@/shared/components/data-table/types'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useEffect, useState } from 'react'

import { DataTableFilterBar } from '@/shared/components/data-table/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/data-table-pagination'
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
}: Props<TData, TMeta>) {
  const isMobile = useIsMobile()
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>(defaultSort ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

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
    columns,
    state: { sorting, columnFilters },
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

  return (
    <div className="space-y-4">
      {filterConfig && filterConfig.length > 0 && (
        <DataTableFilterBar table={table} filters={filterConfig} entityName={entityName} />
      )}

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
                        if (isMobile) {
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

      <DataTablePagination table={table} />
    </div>
  )
}
