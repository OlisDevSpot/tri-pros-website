'use client'

import type { Row } from '@tanstack/react-table'
import type { MouseEvent, ReactNode } from 'react'

import { flexRender } from '@tanstack/react-table'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment, memo } from 'react'

import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'
import { FROZEN_COLUMN_SHADOW } from '@/shared/components/data-table/constants/frozen-column-shadow'
import { AnimatedCollapsibleContent } from '@/shared/components/ui/collapsible'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface DataTableRowProps<TData extends { id: string }> {
  row: Row<TData>
  /** `table.options.meta`. Cells read it from the table; only its identity matters here. */
  meta: unknown
  /** The column definitions. Cells read them from the row; only their identity matters here. */
  columns: unknown
  /** Visible column ids, joined, so hiding or showing a column re-renders the row. */
  visibleColumnIds: string
  isExpanded: boolean
  isFrozen: boolean
  /** By rendered position, not `nth-child`, so an open row's panel row doesn't shift the stripes. */
  isOddRow: boolean
  rowClassName?: string
  rowDataAttribute: string
  detailId: string
  hasExpandedRow: boolean
  /** Built by the body only while the row is expanded. */
  expandedContent: ReactNode
  onRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void
}

function DataTableRowImpl<TData extends { id: string }>({
  row,
  isExpanded,
  isFrozen,
  isOddRow,
  rowClassName,
  rowDataAttribute,
  detailId,
  hasExpandedRow,
  expandedContent,
  onRowClick,
}: DataTableRowProps<TData>) {
  const rowProps: Record<string, unknown> = { [rowDataAttribute]: true }
  // A status tint paints the cells, over the row's hover colour, so it steps aside on hover.
  const tintClassName = rowClassName && cn(rowClassName, 'group-hover:bg-transparent')
  const expandToggle = hasExpandedRow
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
          className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground pressed:bg-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronRightIcon className={cn('size-4 motion-safe:transition-transform', isExpanded && 'rotate-90')} />
        </button>
      )
    : null

  return (
    <Fragment>
      <TableRow
        data-band={isOddRow ? 'odd' : 'even'}
        data-press
        className={cn('group cursor-pointer bg-(--card) hover:bg-row-hover pressed:bg-row-press', isOddRow && 'bg-band')}
        onClick={e => onRowClick(e, row)}
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
                className={cn('sticky left-0 z-5 p-0 border-r border-border bg-inherit', FROZEN_COLUMN_SHADOW)}
                style={{ borderRightStyle: 'dashed' }}
              >
                {tintClassName && <div className={cn('absolute inset-0', tintClassName)} />}
                <div className="relative p-2">
                  {cellContent}
                </div>
              </TableCell>
            )
          }

          return (
            <TableCell key={cell.id} className={tintClassName}>
              {cellContent}
            </TableCell>
          )
        })}
      </TableRow>
      {hasExpandedRow && (
        <TableRow data-expanded-row aria-hidden={!isExpanded || undefined} className="hover:bg-transparent">
          <TableCell colSpan={row.getVisibleCells().length} className={cn('p-0 whitespace-normal', isExpanded && CELL_BORDER)}>
            {/* Pinned to the visible width so the panel stays in view while the columns scroll sideways.
                Sticky breaks if this cell or any ancestor up to the scroller gets overflow: hidden. */}
            <div id={detailId} className="sticky left-0" style={{ width: '100cqw' }}>
              <AnimatedCollapsibleContent open={isExpanded}>
                {expandedContent}
              </AnimatedCollapsibleContent>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

// A refetch that changes one row rebuilds every TanStack Row, so the row's data decides, not the Row instance.
// Query structural sharing keeps unchanged rows' data identical.
function areRowPropsEqual<TData extends { id: string }>(prev: DataTableRowProps<TData>, next: DataTableRowProps<TData>) {
  for (const key of Object.keys(next) as (keyof DataTableRowProps<TData>)[]) {
    if (key !== 'row' && !Object.is(prev[key], next[key])) {
      return false
    }
  }
  return prev.row.original === next.row.original
}

export const DataTableRow = memo(DataTableRowImpl, areRowPropsEqual) as typeof DataTableRowImpl
