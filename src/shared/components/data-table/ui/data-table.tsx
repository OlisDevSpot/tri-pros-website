'use client'

import type { ColumnFiltersState, ColumnSizingState, FilterFnOption, SortingState, VisibilityState } from '@tanstack/react-table'
import type { DataTableProps, DataTableTimePresetFilter } from '@/shared/components/data-table/types'

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

import { SKELETON_CELL_WIDTHS, SKELETON_ROW_HEIGHT_CLASS } from '@/shared/components/data-table/constants/skeleton-widths'
import { createDateRangeFilterFn } from '@/shared/components/data-table/lib/filter-fns'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared class constants
// ---------------------------------------------------------------------------

const CELL_BORDER = 'border-b border-border/50'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // -- Server sort bridge ---------------------------------------------------
  // When `serverSorting` is set, present its sort state to TanStack Table
  // (with fallbackVisual filling in when sortBy is undefined). Column-header
  // clicks dispatch through `serverSorting.onSortChange` instead of mutating
  // local state.

  const sorting: SortingState = useMemo(() => {
    if (!serverSorting) {
      return internalSorting
    }
    if (serverSorting.sortBy) {
      return [{ id: serverSorting.sortBy, desc: serverSorting.sortDir !== 'asc' }]
    }
    if (serverSorting.fallbackVisual) {
      return [serverSorting.fallbackVisual]
    }
    return []
  }, [serverSorting, internalSorting])
  // Default state matches SSR. Hydration from localStorage happens in the
  // effect below — reading during `useState` init renders server-side with
  // defaults but tries to apply saved values during hydration, and React 18
  // refuses to patch layout-affecting attribute mismatches like column
  // widths ("This won't be patched up"). Saved values then never reach the
  // DOM. `isFrozen` uses a `null` sentinel for the pre-hydration value so
  // the persist effect can tell "not yet loaded" from "user chose true".
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isFrozen, setIsFrozen] = useState<boolean | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  // Hydrate from localStorage after mount. The setState calls below are
  // the intentional double-render — server and client both first render
  // with defaults so hydration matches, then this effect updates state to
  // saved values for the next render.
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

  // -- Container width + scroll tracking ------------------------------------

  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

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

  // -- Persist column sizes (debounced) -------------------------------------
  // 300ms debounce keeps localStorage off the drag hot-path. The unmount
  // flush below catches the case where the timer is cancelled before it
  // fires — typically when the user reloads or navigates within 300ms of
  // the last drag tick, which used to silently lose the resize.
  const latestColumnSizing = useRef(columnSizing)
  latestColumnSizing.current = columnSizing

  // Skip the empty state — that covers both the pre-hydration default and
  // the "user reset all columns" case. Both should NOT overwrite saved
  // widths (the first would wipe them on mount; users who genuinely want a
  // clean slate can clear localStorage).
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

  // Synchronous flush on unmount. Reads via ref so we capture the latest
  // sizing — the value closed over by the debounced effect would be stale
  // by the time this cleanup runs. Same empty-state guard.
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

  // -- Persist frozen state -------------------------------------------------
  // Skip the `null` sentinel — that's the pre-hydration value and writing
  // it would clobber the user's saved choice with the default `true`.
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

  // -- Column visibility ----------------------------------------------------

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

  // -- Time-preset filter machinery -----------------------------------------

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

  // -- Active-row management ------------------------------------------------

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

  // -- TanStack Table instance ----------------------------------------------

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
          // Don't dispatch when the click matches the fallback visual — that
          // would write a redundant URL key for the server's natural order.
          const fallback = serverSorting.fallbackVisual
          if (fallback && head.id === fallback.id && head.desc === fallback.desc && !serverSorting.sortBy) {
            return
          }
          serverSorting.onSortChange(head.id, head.desc ? 'desc' : 'asc')
        }
      : setInternalSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
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

  const isAnyColumnResizing = !!table.getState().columnSizingInfo.isResizingColumn

  // -- Exact table & column sizing ------------------------------------------

  const flatHeaders = table.getFlatHeaders()
  const totalDeclaredWidth = flatHeaders.reduce((sum, h) => sum + h.getSize(), 0)
  const effectiveContainer = containerWidth || totalDeclaredWidth
  const needsOverflow = totalDeclaredWidth > effectiveContainer
  const tableWidth = needsOverflow ? totalDeclaredWidth : effectiveContainer
  const lastColExtra = needsOverflow ? 0 : effectiveContainer - totalDeclaredWidth

  // Frozen column shows shadow only when scrolled horizontally
  const showFrozenShadow = isFrozenEffective && isScrolled

  // -- Filtered-data callbacks ----------------------------------------------

  const filteredRows = table.getFilteredRowModel().rows
  const filteredCount = filteredRows.length

  useEffect(() => {
    onFilteredCountChange?.(filteredCount)
  }, [filteredCount, onFilteredCountChange])

  useEffect(() => {
    onFilteredDataChange?.(filteredRows.map(r => r.original))
  }, [filteredRows, onFilteredDataChange])

  // -- Render ---------------------------------------------------------------

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
                        {/* Header content — first col gets a pin toggle */}
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

                        {/* Resize handle — centred on the column's right edge */}
                        {header.column.getCanResize() && !isLastCol && (
                          <div
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

                        {/* Last column: resize handle on the RIGHT edge (inside the cell) */}
                        {header.column.getCanResize() && isLastCol && (
                          <div
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

                return (
                  <TableRow
                    key={row.id}
                    className={`group cursor-pointer border-border/50${customRowClass ? ` ${customRowClass}` : ''}`}
                    onClick={() => {
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
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </TableCell>
                        )
                      }

                      return (
                        <TableCell key={cell.id} className={CELL_BORDER}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
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
