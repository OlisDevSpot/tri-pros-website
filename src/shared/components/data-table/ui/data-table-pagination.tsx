'use client'

import type { Table } from '@tanstack/react-table'

import type { DataTableServerPagination } from '@/shared/components/data-table/types'

import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props<TData> {
  table: Table<TData>
  serverPagination?: DataTableServerPagination
}

/**
 * Pagination footer. Always renders to preserve the parent's flex layout —
 * hiding the footer when there's nothing to paginate causes the scroll area
 * to grow into the freed space, then snap back when content arrives, which
 * looks like jank. Buttons disable themselves when there's no prev/next page.
 */
export function DataTablePagination<TData>({ table, serverPagination }: Props<TData>) {
  const pageCount = Math.max(table.getPageCount(), 1)
  const pageIndex = table.getState().pagination.pageIndex
  const pageSizeOptions = serverPagination?.pageSizeOptions
  const showSizeSelector = !!pageSizeOptions && pageSizeOptions.length > 1

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-2">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          Page
          {' '}
          {pageIndex + 1}
          {' '}
          of
          {' '}
          {pageCount}
        </p>
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
    </div>
  )
}
