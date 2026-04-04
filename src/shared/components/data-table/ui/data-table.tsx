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

import { createDateRangeFilterFn } from '@/shared/components/data-table/lib/filter-fns'
import { DataTableFilterBar } from '@/shared/components/data-table/ui/data-table-filter-bar'
import { DataTablePagination } from '@/shared/components/data-table/ui/data-table-pagination'
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
}: Props<TData, TMeta>) {
  const isMobile = useIsMobile()
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>(defaultSort ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    tableId ? loadColumnSizing(tableId) : {},
  )
  const [isFrozen, setIsFrozen] = useState(() => tableId ? loadFrozen(tableId) : true)
  const [isScrolled, setIsScrolled] = useState(false)

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

  // -- Mobile touch axis-lock ------------------------------------------------

  const touchAxis = useRef<'x' | 'y' | null>(null)
  const touchStart = useRef<{ x: number, y: number } | null>(null)
  const scrollStart = useRef<{ left: number, top: number } | null>(null)
  const AXIS_THRESHOLD = 8

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isMobile) {
      return
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch) {
        return
      }
      touchAxis.current = null
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      scrollStart.current = { left: el!.scrollLeft, top: el!.scrollTop }
    }

    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch || !touchStart.current || !scrollStart.current) {
        return
      }

      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y

      if (!touchAxis.current) {
        if (Math.abs(dx) < AXIS_THRESHOLD && Math.abs(dy) < AXIS_THRESHOLD) {
          return
        }
        touchAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }

      if (touchAxis.current === 'x') {
        el!.scrollTop = scrollStart.current.top
      }
      else {
        el!.scrollLeft = scrollStart.current.left
      }
    }

    function onTouchEnd() {
      touchAxis.current = null
      touchStart.current = null
      scrollStart.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile])

  // -- Persist column sizes (debounced) -------------------------------------

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

  // -- Persist frozen state -------------------------------------------------

  const toggleFrozen = useCallback(() => {
    setIsFrozen((prev) => {
      const next = !prev
      if (tableId) {
        try {
          localStorage.setItem(`${FROZEN_KEY}:${tableId}`, String(next))
        }
        catch { /* localStorage unavailable */ }
      }
      return next
    })
  }, [tableId])

  // -- Column visibility ----------------------------------------------------

  const columnVisibility = useMemo<VisibilityState>(() => {
    const visibility: VisibilityState = {}
    for (const col of columns) {
      const key = 'accessorKey' in col ? col.accessorKey as string : undefined
      if (key && (col.meta as { hidden?: boolean } | undefined)?.hidden) {
        visibility[key] = false
      }
    }
    return visibility
  }, [columns])

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
    state: { sorting, columnFilters, columnVisibility, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
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
  const showFrozenShadow = isFrozen && isScrolled

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
            'grow min-h-0 overflow-auto overscroll-none',
            '**:data-[slot=table-container]:overflow-visible',
            isAnyColumnResizing && 'cursor-col-resize select-none',
          )}
        >
          <Table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth }}>
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
                          isFirstCol && isFrozen && cn(
                            'sticky left-0 z-30 bg-background border-r border-border/50',
                            'transition-shadow duration-200',
                            showFrozenShadow && 'shadow-[4px_0_8px_0_rgba(0,0,0,0.3)]',
                          ),
                        )}
                        style={{
                          width: colWidth,
                          ...(isFirstCol && isFrozen ? { borderRightStyle: 'dashed' as const } : undefined),
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
              {table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map((row) => {
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
                                <div className="absolute inset-0 bg-background group-hover:bg-muted/50" />
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
                  })
                : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No
                        {' '}
                        {entityName}
                        s match your filter.
                      </TableCell>
                    </TableRow>
                  )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
