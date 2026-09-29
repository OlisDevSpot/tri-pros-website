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
import { ChevronRightIcon, PinIcon, RefreshCw } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SKELETON_CELL_WIDTHS, SKELETON_ROW_HEIGHT_CLASS } from '@/shared/components/data-table/constants/skeleton-widths'
import { usePullToRefresh } from '@/shared/components/data-table/hooks/use-pull-to-refresh'
import { createDateRangeFilterFn } from '@/shared/components/data-table/lib/filter-fns'
import { mapColumnSortIds } from '@/shared/components/data-table/lib/map-column-sort-ids'
import { shouldToggleRow } from '@/shared/components/data-table/lib/should-toggle-row'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
import { ErrorState } from '@/shared/components/states/error-state'
import { AnimatedCollapsibleContent } from '@/shared/components/ui/collapsible'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
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

const CELL_BORDER = 'border-b border-border/50'

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
  const [containerWidth, setContainerWidth] = useState(0)

  const { isRefreshing } = usePullToRefresh(scrollRef, serverPagination?.onRefresh)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const flatHeaders = table.getFlatHeaders()
  const totalDeclaredWidth = flatHeaders.reduce((sum, h) => sum + h.getSize(), 0)
  const effectiveContainer = containerWidth || totalDeclaredWidth
  const needsOverflow = totalDeclaredWidth > effectiveContainer
  const tableWidth = needsOverflow ? totalDeclaredWidth : effectiveContainer
  const lastColExtra = needsOverflow ? 0 : effectiveContainer - totalDeclaredWidth

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
            'grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
            '**:data-[slot=table-container]:overflow-visible',
            isAnyColumnResizing && 'cursor-col-resize select-none',
          )}
        >
          <Table
            className="table-fixed border-separate border-spacing-0"
            style={{ width: tableWidth }}
            aria-busy={!!serverPagination?.isFetching}
          >
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
                  {headerGroup.headers.map((header, colIdx) => {
                    const isColResizing = header.column.getIsResizing()
                    const isFirstCol = colIdx === 0
                    const isLastCol = colIdx === headerGroup.headers.length - 1
                    const colWidth = header.getSize() + (isLastCol ? lastColExtra : 0)

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
                      {/* Width = measured container so the spinner centers on the viewport, not the overflowing table. */}
                      <div className="flex h-16 items-end justify-center pb-2" style={{ width: containerWidth || undefined }}>
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
                const dataRows = table.getRowModel().rows
                if (dataRows.length > 0) {
                  return null
                }
                if (serverPagination?.isFetching) {
                  const visibleCols = table.getVisibleFlatColumns()
                  return Array.from({ length: 5 }).map((_, rowIdx) => (
                    // eslint-disable-next-line react/no-array-index-key -- static skeleton list, no reordering
                    <TableRow key={`skeleton-row-${rowIdx}`} className={cn('border-border/50 hover:bg-transparent', SKELETON_ROW_HEIGHT_CLASS)}>
                      {visibleCols.map((col, colIdx) => (
                        <TableCell key={`skeleton-${rowIdx}-${col.id}`} className={CELL_BORDER}>
                          <Skeleton className={cn('h-3.5', SKELETON_CELL_WIDTHS[colIdx % SKELETON_CELL_WIDTHS.length])} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                }
                if (serverPagination?.isError) {
                  return (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 p-0">
                        <ErrorState title={`Couldn't load ${entityName}s`} description="Please try again." className="border-0" />
                      </TableCell>
                    </TableRow>
                  )
                }
                return (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No
                      {' '}
                      {entityName}
                      s match your filter.
                    </TableCell>
                  </TableRow>
                )
              })()}
              {table.getRowModel().rows.map((row) => {
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

                        if (colIdx === 0 && isFrozenEffective) {
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
                          <div id={detailId} className="sticky left-0" style={{ width: containerWidth || undefined }}>
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
          </Table>
        </div>

        <DataTablePagination table={table} serverPagination={serverPagination} />
      </div>
    </div>
  )
}
