'use client'

import type { ColumnDef, ColumnFiltersState, ColumnSizingState, ExpandedState, FilterFnOption, SortingState, VisibilityState } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import type { DataTableFilterConfig, DataTableServerPagination, DataTableServerSorting, DataTableTimePresetFilter } from '@/shared/components/data-table/types'

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
import { usePullToRefresh } from '@/shared/components/data-table/hooks/use-pull-to-refresh'
import { createDateRangeFilterFn } from '@/shared/components/data-table/lib/filter-fns'
import { mapColumnSortIds } from '@/shared/components/data-table/lib/map-column-sort-ids'
import { DataTableBody } from '@/shared/components/data-table/ui/data-table-body'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
import { Table, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

export interface DataTableProps<TData, TMeta = unknown> {
  data: TData[]
  columns: ColumnDef<TData>[]
  meta?: TMeta
  /** Unique ID used to persist column widths to localStorage. Omit to disable persistence. */
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
}

const COL_SIZE_KEY = 'dt-col-sizes'
const FROZEN_KEY = 'dt-frozen'

function loadColumnSizing(tableId: string): ColumnSizingState {
  try {
    const raw = localStorage.getItem(`${COL_SIZE_KEY}:${tableId}`)
    return raw ? JSON.parse(raw) as ColumnSizingState : {}
  }
  catch {
    return {}
  }
}

function loadFrozen(tableId: string): boolean {
  try {
    return localStorage.getItem(`${FROZEN_KEY}:${tableId}`) !== 'false'
  }
  catch {
    return true
  }
}

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
  // Not read from localStorage in the useState init: React refuses to patch layout-affecting
  // hydration mismatches (column widths), so saved values would never reach the DOM.
  // `null` on isFrozen means "not yet hydrated", so the persist effect can skip it.
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isFrozen, setIsFrozen] = useState<boolean | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    if (!tableId) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- hydration sentinel
      setIsFrozen(true)
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- localStorage hydration
    setColumnSizing(loadColumnSizing(tableId))
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- localStorage hydration
    setIsFrozen(loadFrozen(tableId))
  }, [tableId])

  const isFrozenEffective = isFrozen ?? true

  const scrollRef = useRef<HTMLDivElement>(null)

  const { isRefreshing } = usePullToRefresh(scrollRef, serverPagination?.onRefresh)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      setIsScrolled(el.scrollLeft > 0)
    }
  }, [])

  // Debounced to keep localStorage off the drag hot path; the unmount flush below
  // covers a reload or navigation inside the debounce window.
  const latestColumnSizing = useRef(columnSizing)
  latestColumnSizing.current = columnSizing

  // Empty sizing is both the pre-hydration default and "reset all columns" — neither may overwrite saved widths.
  useEffect(() => {
    if (!tableId || Object.keys(columnSizing).length === 0) {
      return
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`${COL_SIZE_KEY}:${tableId}`, JSON.stringify(columnSizing))
      }
      catch { /* localStorage unavailable */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [tableId, columnSizing])

  // Unmount flush reads the ref: the sizing closed over by the debounced effect would be stale here.
  useEffect(() => () => {
    if (!tableId) {
      return
    }
    const sizing = latestColumnSizing.current
    if (Object.keys(sizing).length === 0) {
      return
    }
    try {
      localStorage.setItem(`${COL_SIZE_KEY}:${tableId}`, JSON.stringify(sizing))
    }
    catch { /* localStorage unavailable */ }
  }, [tableId])

  // Persisting the pre-hydration `null` would clobber the saved choice with the default.
  useEffect(() => {
    if (!tableId || isFrozen === null) {
      return
    }
    try {
      localStorage.setItem(`${FROZEN_KEY}:${tableId}`, String(isFrozen))
    }
    catch { /* localStorage unavailable */ }
  }, [tableId, isFrozen])

  const toggleFrozen = useCallback(() => {
    setIsFrozen(prev => !(prev ?? true))
  }, [])

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

  const table = useReactTable({
    data,
    columns: patchedColumns,
    filterFns,
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
    meta: {
      ...meta,
      activeRowId,
    } as TMeta & { activeRowId: string | null },
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

  const showFrozenShadow = isFrozenEffective && isScrolled

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

      <div className="grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            // A size container: the pull spinner and expanded panels size to it with `cqw`, without measuring it.
            '@container grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
            '**:data-[slot=table-container]:overflow-visible',
            isAnyColumnResizing && 'cursor-col-resize select-none',
          )}
        >
          {/* Fills the container or overflows it in CSS alone, so a window resize runs no script and re-renders nothing. */}
          <Table
            className="table-fixed border-separate border-spacing-0"
            style={{ width: totalDeclaredWidth, minWidth: '100%' }}
            aria-busy={!!serverPagination?.isFetching}
          >
            <TableHeader className="sticky top-0 z-10 bg-background">
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
                          isFirstCol && isFrozenEffective && cn(
                            'sticky left-0 z-30 bg-background border-r border-border/50',
                            'transition-shadow duration-200',
                            showFrozenShadow && 'shadow-[4px_0_8px_0_rgba(0,0,0,0.3)]',
                          ),
                        )}
                        style={{
                          width: colWidth,
                          ...(isFirstCol && isFrozenEffective ? { borderRightStyle: 'dashed' as const } : undefined),
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
                                  title={isFrozenEffective ? 'Unfreeze column' : 'Freeze column'}
                                >
                                  <PinIcon
                                    className={cn(
                                      'h-3 w-3 rotate-45 transition-colors',
                                      isFrozenEffective
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
              onRowClick={onRowClick}
              isMobile={isMobile}
              setActiveRowId={setActiveRowId}
              isFrozen={isFrozenEffective}
              showFrozenShadow={showFrozenShadow}
              serverPagination={serverPagination}
              isRefreshing={isRefreshing}
            />
          </Table>
        </div>

        <DataTablePagination table={table} serverPagination={serverPagination} />
      </div>
    </div>
  )
}
