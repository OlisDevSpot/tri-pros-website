'use client'

import type { Row, Table } from '@tanstack/react-table'
import type { MouseEvent, ReactNode } from 'react'
import type { DataTableServerPagination } from '@/shared/components/data-table/types'

import { RefreshCw } from 'lucide-react'
import { memo } from 'react'

import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'
import { SKELETON_CELL_WIDTHS } from '@/shared/components/data-table/constants/skeleton-widths'
import { DataTableRow } from '@/shared/components/data-table/ui/data-table-row'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { TableBody, TableCell, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface DataTableBodyProps<TData extends { id: string }> {
  table: Table<TData>
  /** `table.getRowModel().rows`: a column drag leaves it unchanged, which is what lets the body skip the drag. */
  rows: Row<TData>[]
  isColumnResizing: boolean
  columnCount: number
  entityName: string
  tableId?: string
  rowDataAttribute: string
  getRowClassName?: (row: TData) => string | undefined
  renderExpandedRow?: (row: TData) => ReactNode
  onRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void
  isFrozen: boolean
  serverPagination?: DataTableServerPagination
  isRefreshing: boolean
  skeletonRowClassName: string
}

function DataTableBodyImpl<TData extends { id: string }>({
  table,
  rows,
  columnCount,
  entityName,
  tableId,
  rowDataAttribute,
  getRowClassName,
  renderExpandedRow,
  onRowClick,
  isFrozen,
  serverPagination,
  isRefreshing,
  skeletonRowClassName,
}: DataTableBodyProps<TData>) {
  const meta = table.options.meta
  const columns = table.options.columns
  const visibleColumnIds = table.getVisibleLeafColumns().map(column => column.id).join(',')

  return (
    <TableBody>
      {/* Spacer reflows the rows (a transform would break the frozen column's sticky-left).
          Sized by the `--dt-pull` var the hook writes, so no React render on the drag;
          the opacity divisor must match PULL_TO_REFRESH_THRESHOLD (64). */}
      {serverPagination?.onRefresh && (
        <tr aria-hidden>
          <td colSpan={table.getVisibleFlatColumns().length} className="border-0 p-0">
            <div
              className="overflow-hidden"
              style={{ height: 'calc(var(--dt-pull, 0) * 1px)', transition: 'height var(--dt-pull-ms, 0ms) ease-out' }}
            >
              {/* Container width, so the spinner centers on the visible width, not the overflowing table. */}
              <div className="flex h-16 items-end justify-center pb-2" style={{ width: '100cqw' }}>
                <div
                  className="rounded-full border border-border/50 bg-background p-1.5 shadow-sm"
                  style={{ opacity: 'calc(var(--dt-pull, 0) / 64)', transition: 'opacity var(--dt-pull-ms, 0ms) ease-out' }}
                >
                  <RefreshCw className={cn('size-4 text-muted-foreground', isRefreshing && 'motion-safe:animate-spin')} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
      {(() => {
        if (rows.length > 0) {
          return null
        }
        // A stale empty result is the previous key's; saying "no match" for the key still loading would be false.
        if (serverPagination?.isFetching || serverPagination?.isStale) {
          const visibleCols = table.getVisibleFlatColumns()
          return Array.from({ length: 5 }).map((_, rowIdx) => (
            // eslint-disable-next-line react/no-array-index-key -- static skeleton list, no reordering
            <TableRow key={`skeleton-row-${rowIdx}`} className={cn('border-border/50 hover:bg-transparent', skeletonRowClassName)}>
              {visibleCols.map((col, colIdx) => (
                <TableCell key={`skeleton-${rowIdx}-${col.id}`} className={CELL_BORDER}>
                  <Skeleton className={cn('h-3.5', SKELETON_CELL_WIDTHS[colIdx % SKELETON_CELL_WIDTHS.length])} />
                </TableCell>
              ))}
            </TableRow>
          ))
        }
        return (
          <TableRow>
            <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
              No
              {' '}
              {entityName}
              s match your filter.
            </TableCell>
          </TableRow>
        )
      })()}
      {rows.map((row) => {
        const isExpanded = row.getIsExpanded()
        return (
          <DataTableRow
            key={row.id}
            row={row}
            meta={meta}
            columns={columns}
            visibleColumnIds={visibleColumnIds}
            isExpanded={isExpanded}
            isFrozen={isFrozen}
            rowClassName={getRowClassName?.(row.original)}
            rowDataAttribute={rowDataAttribute}
            detailId={`${tableId ?? entityName}-detail-${row.id}`}
            hasExpandedRow={!!renderExpandedRow}
            expandedContent={isExpanded && renderExpandedRow ? renderExpandedRow(row.original) : null}
            onRowClick={onRowClick}
          />
        )
      })}
    </TableBody>
  )
}

// Every mousemove of a column drag re-renders the header; body cells take their widths from the header row
// (table-layout: fixed), so the body sits the drag out unless its rows change. TanStack's column-resizing pattern.
export const DataTableBody = memo(
  DataTableBodyImpl,
  (prev, next) => next.isColumnResizing && prev.rows === next.rows,
) as typeof DataTableBodyImpl
