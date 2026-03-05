'use client'

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table'
import type { Proposal } from '@/shared/db/schema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDownIcon, CopyIcon, ExternalLinkIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { ROOTS } from '@/shared/config/roots'
import { useGetProposals } from '@/shared/dal/client/proposals/queries/use-get-proposals'
import { formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const STATUS_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-neutral-700 text-neutral-100',
  sent: 'bg-yellow-800 text-yellow-100',
  approved: 'bg-green-800 text-green-100',
  declined: 'bg-red-800 text-red-100',
}

function useProposalActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries(trpc.proposalRouter.getProposals.queryOptions())

  const deleteProposal = useMutation(trpc.proposalRouter.deleteProposal.mutationOptions({
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete proposal'),
  }))

  const duplicateProposal = useMutation(trpc.proposalRouter.duplicateProposal.mutationOptions({
    onSuccess: () => {
      invalidate()
      toast.success('Proposal duplicated')
    },
    onError: () => toast.error('Failed to duplicate proposal'),
  }))

  return { deleteProposal, duplicateProposal }
}

function useColumns(): ColumnDef<Proposal>[] {
  const { deleteProposal, duplicateProposal } = useProposalActions()

  return [
    {
      accessorKey: 'label',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Proposal
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <p className="font-medium leading-none">{row.original.label}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.homeownerJSON.data.name}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={cn('capitalize text-xs', STATUS_COLORS[row.original.status])}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'address',
      header: 'Address',
      accessorFn: row =>
        `${row.projectJSON.data.address}, ${row.projectJSON.data.city}`,
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          <p>{row.original.projectJSON.data.address}</p>
          <p>
            {row.original.projectJSON.data.city}
            {', '}
            {row.original.projectJSON.data.state}
            {' '}
            {row.original.projectJSON.data.zip}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Created
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatStringAsDate(row.original.createdAt)}
        </span>
      ),
      sortingFn: 'datetime',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button asChild size="icon" variant="ghost" className="h-8 w-8">
              <Link href={`${ROOTS.proposalFlow()}/proposal/${p.id}`}>
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                <span className="sr-only">View</span>
              </Link>
            </Button>
            <Button asChild size="icon" variant="ghost" className="h-8 w-8">
              <Link href={`${ROOTS.proposalFlow()}?step=edit-proposal&proposalId=${p.id}`}>
                <PencilIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Edit</span>
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={duplicateProposal.isPending}
              onClick={() => duplicateProposal.mutate({ proposalId: p.id })}
            >
              <CopyIcon className="h-3.5 w-3.5" />
              <span className="sr-only">Duplicate</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={deleteProposal.isPending}
              onClick={() => deleteProposal.mutate({ proposalId: p.id })}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        )
      },
    },
  ]
}

function ProposalsTable({ data }: { data: Proposal[] }) {
  const columns = useColumns()
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

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/50">
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
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
                  <TableRow key={row.id} className="border-border/50">
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

export function PastProposalsView() {
  const proposals = useGetProposals()

  if (proposals.isLoading) {
    return (
      <LoadingState
        title="Loading Past Proposals"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!proposals.data) {
    return (
      <ErrorState
        title="Error: Could not load past proposals"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (proposals.data.length === 0) {
    return (
      <ErrorState
        title="No Proposals Found"
        description="Create a new proposal"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <Card className="h-full w-full flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>Past Proposals</CardTitle>
          <CardDescription>
            {proposals.data.length}
            {' '}
            total proposal
            {proposals.data.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grow min-h-0 overflow-auto">
          <ProposalsTable data={proposals.data} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
