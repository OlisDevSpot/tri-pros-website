'use client'

import type { Row, Table } from '@tanstack/react-table'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { DataTableServerPagination } from '@/shared/components/data-table/types'

import { flexRender } from '@tanstack/react-table'
import { ChevronRightIcon, RefreshCw } from 'lucide-react'
import { Fragment, memo } from 'react'

import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'
import { SKELETON_CELL_WIDTHS } from '@/shared/components/data-table/constants/skeleton-widths'
import { shouldToggleRow } from '@/shared/components/data-table/lib/should-toggle-row'
import { AnimatedCollapsibleContent } from '@/shared/components/ui/collapsible'
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
  onRowClick?: (row: TData) => void
  isMobile: boolean
  setActiveRowId: Dispatch<SetStateAction<string | null>>
  isFrozen: boolean
  showFrozenShadow: boolean
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
  isMobile,
  setActiveRowId,
  isFrozen,
  showFrozenShadow,
  serverPagination,
  isRefreshing,
  skeletonRowClassName,
}: DataTableBodyProps<TData>) {
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
              {/* Container width, so the spinner centers on the viewport, not the overflowing table. */}
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
        const rowProps: Record<string, unknown> = { [rowDataAttribute]: true }
        const customRowClass = getRowClassName?.(row.original)
        const isExpanded = row.getIsExpanded()
        const detailId = `${tableId ?? entityName}-detail-${row.id}`
        const expandToggle = renderExpandedRow
          ? (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailId}
                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                onClick={(e) => {
                  e.stopPropagation()
                  row.toggleExpanded()
                }}
                className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <ChevronRightIcon className={cn('size-4 motion-safe:transition-transform', isExpanded && 'rotate-90')} />
              </button>
            )
          : null

        return (
          <Fragment key={row.id}>
            <TableRow
              className={`group cursor-pointer border-border/50${customRowClass ? ` ${customRowClass}` : ''}`}
              onClick={(e) => {
                if (renderExpandedRow) {
                  if (shouldToggleRow(e, window.getSelection()?.toString() ?? '')) {
                    row.toggleExpanded()
                  }
                  return
                }
                if (onRowClick) {
                  onRowClick(row.original)
                }
                else if (isMobile) {
                  setActiveRowId(prev => prev === row.original.id ? null : row.original.id)
                }
              }}
              {...rowProps}
            >
              {row.getVisibleCells().map((cell, colIdx) => {
                const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                const cellContent = colIdx === 0 && expandToggle
                  ? (
                      <div className="flex items-center gap-1">
                        {expandToggle}
                        <div className="min-w-0 flex-1">{content}</div>
                      </div>
                    )
                  : content

                if (colIdx === 0 && isFrozen) {
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'sticky left-0 z-5 p-0 border-r border-border/50',
                        CELL_BORDER,
                        'transition-shadow duration-200',
                        showFrozenShadow && 'shadow-[4px_0_8px_0_rgba(0,0,0,0.3)]',
                      )}
                      style={{ borderRightStyle: 'dashed' }}
                    >
                      <div className="absolute inset-0 bg-background group-hover:bg-muted/50 transition-colors" />
                      {customRowClass && <div className={cn('absolute inset-0', customRowClass)} />}
                      <div className="relative p-2">
                        {cellContent}
                      </div>
                    </TableCell>
                  )
                }

                return (
                  <TableCell key={cell.id} className={CELL_BORDER}>
                    {cellContent}
                  </TableCell>
                )
              })}
            </TableRow>
            {renderExpandedRow && (
              <TableRow data-expanded-row aria-hidden={!isExpanded || undefined} className="hover:bg-transparent">
                <TableCell colSpan={row.getVisibleCells().length} className={cn('p-0 whitespace-normal', isExpanded && CELL_BORDER)}>
                  {/* Pinned to the visible width so the panel stays in view while the columns scroll sideways.
                      Sticky breaks if this cell or any ancestor up to the scroller gets overflow: hidden. */}
                  <div id={detailId} className="sticky left-0" style={{ width: '100cqw' }}>
                    <AnimatedCollapsibleContent open={isExpanded}>
                      {isExpanded ? renderExpandedRow(row.original) : null}
                    </AnimatedCollapsibleContent>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </Fragment>
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
