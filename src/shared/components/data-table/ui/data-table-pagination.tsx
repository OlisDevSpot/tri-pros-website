'use client'

import type { Table } from '@tanstack/react-table'

import type { DataTableServerPagination } from '@/shared/components/data-table/types'

import { DataTablePaginationButton } from '@/shared/components/data-table/ui/data-table-pagination-button'
import { formatPageOf } from '@/shared/lib/pagination-format'

interface Props<TData> {
  table: Table<TData>
  serverPagination?: DataTableServerPagination
}

/**
 * Pagination footer. Always renders to preserve the parent's flex layout —
 * hiding the footer when there's nothing to paginate causes the scroll area
 * to grow into the freed space, then snap back when content arrives, which
 * looks like jank. Buttons disable themselves when there's no prev/next page.
 *
 * Layout: 3-column grid — Previous (full cell, left-justified mobile),
 * `Page X of Y` (centered, tabular nums), Next (full cell, right-justified
 * mobile). Symmetric thumb reach on phones; rows-per-page lives only in the
 * toolbar / mobile filter sheet, not duplicated here.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the footer above the iOS home
 * indicator when used in a sticky/full-bleed container.
 */
export function DataTablePagination<TData>({ table, serverPagination }: Props<TData>) {
  const pageCount = Math.max(table.getPageCount(), 1)
  const pageIndex = table.getState().pagination.pageIndex

  return (
    <nav
      aria-label="Pagination"
      className="grid shrink-0 grid-cols-3 items-stretch border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
    >
      <DataTablePaginationButton
        direction="prev"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      />
      <div className="flex items-center justify-center px-2">
        <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
          {formatPageOf(pageIndex + 1, pageCount)}
        </span>
        {serverPagination?.isFetching && (
          <span aria-hidden className="ml-2 hidden text-xs text-muted-foreground/70 lg:inline">
            Updating…
          </span>
        )}
      </div>
      <DataTablePaginationButton
        direction="next"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      />
    </nav>
  )
}
