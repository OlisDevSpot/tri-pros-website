import type { ColumnFiltersState, SortingState } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { CopyIcon, EyeIcon, PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useProposalActions } from '@/features/proposal-flow/hooks/use-proposal-actions'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { ROOTS } from '@/shared/config/roots'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { getColumns } from './columns'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalRouter']['getProposals'][number]

interface OverlayState {
  proposalId: string
  top: number
  height: number
}

export function PastProposalsTable({ data }: { data: ProposalRow[] }) {
  const isMobile = useIsMobile()
  const { duplicateProposal } = useProposalActions()

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)

  const [overlayState, setOverlayState] = useState<OverlayState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const overlayButtonsRef = useRef<HTMLDivElement>(null)
  const firstColRef = useRef<HTMLTableCellElement>(null)

  function computeOverlay(id: string) {
    const rowEl = rowRefs.current.get(id)
    const containerEl = containerRef.current
    if (!rowEl || !containerEl) {
      return
    }
    const cr = containerEl.getBoundingClientRect()
    const rr = rowEl.getBoundingClientRect()
    setOverlayState({ proposalId: id, top: rr.top - cr.top, height: rr.height })
  }

  // Mobile: dismiss when the user taps anywhere outside the active row
  useEffect(() => {
    if (!activeRowId) {
      return
    }

    function handleClickOutside(e: MouseEvent) {
      const activeRowEl = rowRefs.current.get(activeRowId!)
      if (activeRowEl?.contains(e.target as Node)) {
        return // tapping the same row is handled by the row's onClick (toggle)
      }
      setActiveRowId(null)
    }

    // Skip the current event that just set activeRowId by deferring to next tick
    const timerId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timerId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [activeRowId])

  const columns = getColumns()

  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  const overlayVisible = overlayState !== null
    && (isMobile ? activeRowId === overlayState.proposalId : hoveredRowId === overlayState.proposalId)

  const overlayProposal = overlayState
    ? data.find(p => p.id === overlayState.proposalId)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter proposals..."
          value={(table.getColumn('label')?.getFilterValue() as string) ?? ''}
          onChange={e => table.getColumn('label')?.setFilterValue(e.target.value)}
          className="max-w-72"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {table.getFilteredRowModel().rows.length}
          {' '}
          proposal
          {table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div ref={containerRef} className="relative rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
                {headerGroup.headers.map((header, i) => (
                  <TableHead key={header.id} ref={i === 0 ? firstColRef : undefined}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0
              ? table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    ref={(el) => {
                      if (el) {
                        rowRefs.current.set(row.original.id, el)
                      }
                      else {
                        rowRefs.current.delete(row.original.id)
                      }
                    }}
                    className="cursor-pointer border-border/50"
                    onMouseEnter={() => {
                      if (!isMobile) {
                        setHoveredRowId(row.original.id)
                        computeOverlay(row.original.id)
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isMobile) {
                        const related = e.relatedTarget instanceof Node ? e.relatedTarget : null
                        if (overlayButtonsRef.current?.contains(related)) {
                          return // mouse moved to the overlay buttons — keep showing
                        }
                        setHoveredRowId(null)
                      }
                    }}
                    onClick={() => {
                      if (isMobile) {
                        const next = activeRowId === row.original.id ? null : row.original.id
                        setActiveRowId(next)
                        if (next) {
                          computeOverlay(next)
                        }
                      }
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No proposals match your filter.
                    </TableCell>
                  </TableRow>
                )}
          </TableBody>
        </Table>

        {/*
          Overlay: pointer-events-none on the wrapper so the mouse "passes through"
          to the <tr> beneath — this prevents onMouseLeave flickering on desktop.
          The inner button group re-enables pointer events so buttons remain clickable.
        */}
        <div
          aria-hidden
          style={overlayState ? { top: overlayState.top, height: overlayState.height } : undefined}
          className={cn(
            'absolute left-0 right-0 z-10 pointer-events-none',
            'bg-background/55',
            'transition-opacity duration-200 ease-in-out',
            overlayVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Buttons anchored to the right edge of the first column */}
          <div
            ref={overlayButtonsRef}
            style={{ width: firstColRef.current?.offsetWidth ?? 0 }}
            className={cn(
              'absolute top-0 bottom-0 left-0 flex items-center justify-end gap-1 pr-3',
              overlayVisible ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            onMouseLeave={(e) => {
              if (!isMobile) {
                const related = e.relatedTarget instanceof Node ? e.relatedTarget : null
                const rowEl = hoveredRowId ? rowRefs.current.get(hoveredRowId) : null
                if (rowEl?.contains(related)) {
                  return // mouse moved back to the row — keep showing
                }
                setHoveredRowId(null)
              }
            }}
          >
            {overlayProposal && (
              <>
                <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                  <a
                    href={`${ROOTS.proposalFlow()}/proposal/${overlayProposal.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <EyeIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">View</span>
                  </a>
                </Button>
                <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                  <Link href={`${ROOTS.proposalFlow()}?step=edit-proposal&proposalId=${overlayProposal.id}`}>
                    <PencilIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={duplicateProposal.isPending}
                  onClick={() => duplicateProposal.mutate({ proposalId: overlayProposal.id })}
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">Duplicate</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {table.getPageCount() > 1 && (
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
      )}
    </div>
  )
}
