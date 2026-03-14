'use client'

import type { Table } from '@tanstack/react-table'

import { Button } from '@/shared/components/ui/button'

interface Props<TData> {
  table: Table<TData>
}

export function DataTablePagination<TData>({ table }: Props<TData>) {
  if (table.getPageCount() <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-sm text-muted-foreground">
        Page
        {' '}
        {table.getState().pagination.pageIndex + 1}
        {' '}
        of
        {' '}
        {table.getPageCount()}
      </p>
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
