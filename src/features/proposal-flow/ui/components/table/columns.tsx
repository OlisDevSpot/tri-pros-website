import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'
import { ArrowUpDownIcon, EyeIcon } from 'lucide-react'
import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalRouter']['getProposals'][number]

export function getColumns(): ColumnDef<ProposalRow>[] {
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
        <Badge className={cn('capitalize text-xs', PROPOSAL_STATUS_COLORS[row.original.status])}>
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
      accessorKey: 'viewCount',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <EyeIcon className="mr-1.5 h-3.5 w-3.5" />
          Seen
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row }) => {
        const views = row.original.viewCount
        const lastViewed = row.original.lastViewedAt

        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <EyeIcon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  views === 0 && 'text-muted-foreground/40',
                  views > 0 && views < 3 && 'text-amber-500',
                  views >= 3 && 'text-emerald-500',
                )}
              />
              <span
                className={cn(
                  'tabular-nums text-sm font-semibold',
                  views === 0 && 'text-muted-foreground/50',
                  views > 0 && views < 3 && 'text-amber-500',
                  views >= 3 && 'text-emerald-500',
                )}
              >
                {views === 0 ? '—' : views}
              </span>
            </div>
            {lastViewed && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatStringAsDate(lastViewed, { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        )
      },
      sortingFn: 'basic',
    },
  ]
}
