'use client'

import type { ColumnDef, ColumnFiltersState, ColumnSizingState, ExpandedState, Row, SortingState, TableMeta, Updater, VisibilityState } from '@tanstack/react-table'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { DataTableFilterConfig, DataTableServerPagination, DataTableServerSorting } from '@/shared/components/data-table/types'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { PinIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'
import { FROZEN_COLUMN_SHADOW } from '@/shared/components/data-table/constants/frozen-column-shadow'
import { SKELETON_ROW_HEIGHT_CLASS } from '@/shared/components/data-table/constants/skeleton-widths'
import { useTablePreferences } from '@/shared/components/data-table/contexts/table-preferences-context'
import { usePullToRefresh } from '@/shared/components/data-table/hooks/use-pull-to-refresh'
import { isRowClick } from '@/shared/components/data-table/lib/is-row-click'
import { mapColumnSortIds } from '@/shared/components/data-table/lib/map-column-sort-ids'
import { DataTableBody } from '@/shared/components/data-table/ui/data-table-body'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
import { Table, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { cn } from '@/shared/lib/utils'

export interface DataTableProps<TData, TMeta = unknown> {
  data: TData[]
  columns: ColumnDef<TData>[]
  /**
   * Read by cells through `table.options.meta`. Function entries are event callbacks: they stay stable and
   * always run the latest version. Anything a cell reads while rendering must be a value, because rows
   * re-render only when a value here changes identity. For the same reason, cells must not read table state
   * or selection (`table.getState()`, `row.getIsSelected()`) while rendering: rows re-render only when their
   * data, expansion, `meta` values or columns change.
   */
  meta?: TMeta
  /** Unique ID under which the viewer's column widths, frozen column and hidden columns persist. Omit to keep them for this mount only. */
  tableId?: string
  filterConfig?: DataTableFilterConfig[]
  defaultSort?: SortingState
  /** Client-side page size. Ignored when `serverPagination` is provided. */
  pageSize?: number
  entityName?: string
  rowDataAttribute?: string
  getRowClassName?: (row: TData) => string | undefined
  onRowClick?: (row: TData) => void
  /** When set, a row click expands the row and renders this below it instead of calling `onRowClick`. */
  renderExpandedRow?: (row: TData) => ReactNode
  onFilteredCountChange?: (count: number) => void
  onFilteredDataChange?: (data: TData[]) => void
  /** When set, the caller owns page state and `data` holds only the current page's rows. */
  serverPagination?: DataTableServerPagination
  serverSorting?: DataTableServerSorting
  columnVisibility?: VisibilityState
  /** The loading rows' height class, when this table's rows render at a height other than the default's. */
  skeletonRowClassName?: string
}

const NO_COLUMN_SIZING: ColumnSizingState = {}
const NO_META = {}

interface Props<TData, TMeta = unknown> extends DataTableProps<TData, TMeta> {
  onActiveRowChange?: (id: string | null) => void
}

export function DataTable<TData extends { id: string }, TMeta = unknown>({
  data,
  columns,
  meta,
  tableId,
  filterConfig,
  defaultSort,
  pageSize = 15,
  entityName = 'row',
  rowDataAttribute = 'data-table-row',
  getRowClassName,
  onActiveRowChange,
  onRowClick,
  renderExpandedRow,
  onFilteredCountChange,
  onFilteredDataChange,
  serverPagination,
  serverSorting,
  columnVisibility: controlledColumnVisibility,
  skeletonRowClassName = SKELETON_ROW_HEIGHT_CLASS,
}: Props<TData, TMeta>) {
  const isMobile = useIsMobile()
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [internalSorting, setInternalSorting] = useState<SortingState>(defaultSort ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const { sortIdByColumnId, columnIdBySortId } = useMemo(() => mapColumnSortIds(columns), [columns])

  const sorting: SortingState = useMemo(() => {
    if (!serverSorting) {
      return internalSorting
    }
    const shown = serverSorting.sortBy
      ? { sortId: serverSorting.sortBy, desc: serverSorting.sortDir !== 'asc' }
      : serverSorting.fallbackVisual && { sortId: serverSorting.fallbackVisual.id, desc: serverSorting.fallbackVisual.desc }
    const columnId = shown ? columnIdBySortId.get(shown.sortId) : undefined
    return shown && columnId ? [{ id: columnId, desc: shown.desc }] : []
  }, [serverSorting, internalSorting, columnIdBySortId])
  const [preferences, updatePreferences] = useTablePreferences(tableId)
  const columnSizing = preferences.sizes ?? NO_COLUMN_SIZING
  const isFrozen = preferences.frozen ?? true

  const scrollRef = useRef<HTMLDivElement>(null)

  const { isRefreshing } = usePullToRefresh(scrollRef, serverPagination?.onRefresh)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.toggleAttribute('data-scrolled', el.scrollLeft > 0)
    }
  }, [])

  // Whole pixels, so the width the server renders from the cookie is the width the client computes.
  const setColumnSizing = useCallback((updater: Updater<ColumnSizingState>) => {
    updatePreferences((prev) => {
      const next = typeof updater === 'function' ? updater(prev.sizes ?? NO_COLUMN_SIZING) : updater
      return { ...prev, sizes: Object.fromEntries(Object.entries(next).map(([id, width]) => [id, Math.round(width)])) }
    })
  }, [updatePreferences])

  const toggleFrozen = useCallback(() => {
    updatePreferences(prev => ({ ...prev, frozen: (prev.frozen ?? true) ? false : undefined }))
  }, [updatePreferences])

  const fallbackColumnVisibility = useMemo<VisibilityState>(() => {
    const visibility: VisibilityState = {}
    for (const col of columns) {
      const key = 'accessorKey' in col ? col.accessorKey as string : undefined
      if (key && (col.meta as { hidden?: boolean } | undefined)?.hidden) {
        visibility[key] = false
      }
    }
    return visibility
  }, [columns])

  const columnVisibility = controlledColumnVisibility ?? fallbackColumnVisibility

  useEffect(() => {
    onActiveRowChange?.(activeRowId)
  }, [activeRowId, onActiveRowChange])

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

  const stableMeta = useStableCallbacks((meta ?? NO_META) as object) as TableMeta<TData>
  const { handleRowClick } = useStableCallbacks({
    handleRowClick: (event: ReactMouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (onRowClick || renderExpandedRow) {
        if (!isRowClick(event, window.getSelection()?.toString() ?? '')) {
          return
        }
        if (renderExpandedRow) {
          row.toggleExpanded()
        }
        else {
          onRowClick?.(row.original)
        }
      }
      else if (isMobile) {
        setActiveRowId(prev => prev === row.original.id ? null : row.original.id)
      }
    },
  })

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { minSize: 60, maxSize: 800 },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      expanded,
      ...(serverPagination
        ? { pagination: { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize } }
        : {}),
    },
    onSortingChange: serverSorting
      ? (updater) => {
          const next = typeof updater === 'function' ? updater(sorting) : updater
          const head = next[0]
          if (!head) {
            serverSorting.onSortChange(undefined)
            return
          }
          const sortId = sortIdByColumnId.get(head.id)
          if (!sortId) {
            return
          }
          // Matching the fallback visual would write a redundant URL key for the server's natural order.
          const fallback = serverSorting.fallbackVisual
          if (fallback && sortId === fallback.id && head.desc === fallback.desc && !serverSorting.sortBy) {
            return
          }
          serverSorting.onSortChange(sortId, head.desc ? 'desc' : 'asc')
        }
      : setInternalSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onExpandedChange: setExpanded,
    getRowId: row => row.id,
    getRowCanExpand: () => !!renderExpandedRow,
    // Expansion is cleared on page, size and sort changes below; a same-page refetch keeps rows open.
    autoResetExpanded: false,
    onPaginationChange: serverPagination
      ? (updater) => {
          const prev = { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize }
          const next = typeof updater === 'function' ? updater(prev) : updater
          if (next.pageIndex !== prev.pageIndex) {
            serverPagination.onPageChange(next.pageIndex)
          }
          if (next.pageSize !== prev.pageSize) {
            serverPagination.onPageSizeChange?.(next.pageSize)
          }
        }
      : undefined,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(serverPagination
      ? { manualPagination: true, manualFiltering: true, rowCount: serverPagination.rowCount }
      : { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } } }),
    ...(serverSorting ? { manualSorting: true } : {}),
    meta: stableMeta,
  })

  // Derived during render, not in a handler: page size and the toolbar's Reset change the URL state without going through this table's handlers.
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination
  const expansionResetKey = `${pageIndex}:${currentPageSize}:${JSON.stringify(sorting)}`
  const [lastExpansionResetKey, setLastExpansionResetKey] = useState(expansionResetKey)
  if (expansionResetKey !== lastExpansionResetKey) {
    setLastExpansionResetKey(expansionResetKey)
    setExpanded({})
  }

  const isAnyColumnResizing = !!table.getState().columnSizingInfo.isResizingColumn

  const totalDeclaredWidth = table.getFlatHeaders().reduce((sum, h) => sum + h.getSize(), 0)

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

      <div className="grow min-h-0 flex flex-col rounded-xl border overflow-hidden surface">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            'group/scroller grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
            // The pull spinner and expanded panels size to the visible width with `cqw`, without measuring it.
            // The size container is this scroller's full-width child, not the scroller: Chromium resolves a
            // scroller's own `cqw` with its vertical scrollbar included, so `100cqw` overflowed it sideways.
            '**:data-[slot=table-container]:overflow-visible *:data-[slot=table-container]:@container',
            isAnyColumnResizing && 'cursor-col-resize select-none',
          )}
        >
          {/* Fills the container or overflows it in CSS alone, so a window resize runs no script and re-renders nothing. */}
          <Table
            className="table-fixed border-separate border-spacing-0 transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200"
            style={{ width: totalDeclaredWidth, minWidth: '100%' }}
            aria-busy={!!(serverPagination?.isFetching || serverPagination?.isStale)}
            data-stale={serverPagination?.isStale || undefined}
          >
            <TableHeader className="sticky top-0 z-10 bg-(--card)">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
                  {headerGroup.headers.map((header, colIdx) => {
                    const isColResizing = header.column.getIsResizing()
                    const isFirstCol = colIdx === 0
                    const isLastCol = colIdx === headerGroup.headers.length - 1
                    // Under table-layout: fixed the one auto-width column takes the slack, so the last column fills a wide container.
                    const colWidth = isLastCol ? undefined : header.getSize()

                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'group/th relative',
                          CELL_BORDER,
                          isFirstCol && isFrozen && cn(
                            'sticky left-0 z-30 bg-(--card) border-r border-border/50',
                            FROZEN_COLUMN_SHADOW,
                          ),
                        )}
                        style={{
                          width: colWidth,
                          ...(isFirstCol && isFrozen ? { borderRightStyle: 'dashed' as const } : undefined),
                        }}
                      >
                        {isFirstCol
                          ? (
                              <div className="flex items-center gap-1">
                                <div className="min-w-0 flex-1">
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleFrozen()
                                  }}
                                  className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-muted"
                                  title={isFrozen ? 'Unfreeze column' : 'Freeze column'}
                                >
                                  <PinIcon
                                    className={cn(
                                      'h-3 w-3 rotate-45 transition-colors',
                                      isFrozen
                                        ? 'fill-foreground text-foreground'
                                        : 'text-muted-foreground/50',
                                    )}
                                  />
                                </button>
                              </div>
                            )
                          : (header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())
                            )}

                        {header.column.getCanResize() && !isLastCol && (
                          <div
                            data-resize-handle
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onDoubleClick={() => header.column.resetSize()}
                            className="absolute right-0 translate-x-1/2 top-0 z-30 w-2 cursor-col-resize select-none touch-none"
                            style={{ height: isColResizing ? 9999 : '100%' }}
                          >
                            <div
                              className={cn(
                                'mx-auto h-full',
                                isColResizing
                                  ? 'w-0.5 border-l-2 border-dashed border-primary'
                                  : 'w-px opacity-0 bg-border group-hover/th:opacity-100',
                              )}
                            />
                          </div>
                        )}

                        {header.column.getCanResize() && isLastCol && (
                          <div
                            data-resize-handle
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onDoubleClick={() => header.column.resetSize()}
                            className="absolute right-0 top-0 z-30 w-1 cursor-col-resize select-none touch-none"
                            style={{ height: isColResizing ? 9999 : '100%' }}
                          >
                            <div
                              className={cn(
                                'ml-auto h-full',
                                isColResizing
                                  ? 'w-0.5 border-l-2 border-dashed border-primary'
                                  : 'w-px opacity-0 bg-border group-hover/th:opacity-100',
                              )}
                            />
                          </div>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <DataTableBody
              table={table}
              rows={table.getRowModel().rows}
              isColumnResizing={isAnyColumnResizing}
              columnCount={columns.length}
              entityName={entityName}
              tableId={tableId}
              rowDataAttribute={rowDataAttribute}
              getRowClassName={getRowClassName}
              renderExpandedRow={renderExpandedRow}
              onRowClick={handleRowClick}
              isFrozen={isFrozen}
              serverPagination={serverPagination}
              isRefreshing={isRefreshing}
              skeletonRowClassName={skeletonRowClassName}
            />
          </Table>
        </div>

        <DataTablePagination table={table} serverPagination={serverPagination} />
      </div>
    </div>
  )
}
