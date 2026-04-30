'use client'

import type { Table } from '@tanstack/react-table'

import type { DataTableServerPagination } from '@/shared/components/data-table/types'

import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props<TData> {
  table: Table<TData>
  serverPagination?: DataTableServerPagination
}

export function DataTablePagination<TData>({ table, serverPagination }: Props<TData>) {
  const pageCount = table.getPageCount()
  const pageSizeOptions = serverPagination?.pageSizeOptions
  const showSizeSelector = !!pageSizeOptions && pageSizeOptions.length > 1

  // Hide the entire footer only when there's a single page AND no size selector
  // would render. With a size selector present we always show it so the user
  // can shrink page-size to see more pages.
  if (pageCount <= 1 && !showSizeSelector) {
    return null
  }

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-2">
      <div className="flex items-center gap-3">
        {pageCount > 1 && (
          <p className="text-sm text-muted-foreground">
            Page
            {' '}
            {table.getState().pagination.pageIndex + 1}
            {' '}
            of
            {' '}
            {pageCount}
          </p>
        )}
        {showSizeSelector && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={v => serverPagination?.onPageSizeChange?.(Number(v))}
            >
              <SelectTrigger className="h-7 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {serverPagination?.isFetching && (
          <span className="text-xs text-muted-foreground">Loading…</span>
        )}
      </div>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
