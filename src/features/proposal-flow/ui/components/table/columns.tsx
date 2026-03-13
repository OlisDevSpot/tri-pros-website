import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { ProposalStatus } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'
import { ArrowUpDownIcon, CheckIcon, CopyIcon, EyeIcon, PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { ROOTS } from '@/shared/config/roots'
import { proposalStatuses } from '@/shared/constants/enums'
import { formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalRouter']['getProposals'][number]

export interface ProposalTableMeta {
  activeRowId: string | null
  onDuplicate: (proposalId: string) => void
  isDuplicating: boolean
  onUpdateStatus: (proposalId: string, status: ProposalStatus) => void
}

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
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        const isActive = meta?.activeRowId === row.original.id

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">{row.original.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.original.homeownerJSON.data.name}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {row.original.label}
              </TooltipContent>
            </Tooltip>
            <div
              className={cn(
                'flex items-center gap-1 shrink-0 opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100',
                isActive && 'opacity-100',
              )}
              onClick={e => e.stopPropagation()}
            >
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <a
                  href={`${ROOTS.proposalPublic()}/proposal/${row.original.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">View</span>
                </a>
              </Button>
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <Link href={`${ROOTS.dashboard()}?step=edit-proposal&proposalId=${row.original.id}`}>
                  <PencilIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit</span>
                </Link>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={meta?.isDuplicating}
                onClick={() => meta?.onDuplicate(row.original.id)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Duplicate</span>
              </Button>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        const current = row.original.status

        return (
          <Popover>
            <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
              <button type="button" className="cursor-pointer">
                <Badge className={cn('capitalize text-xs', PROPOSAL_STATUS_COLORS[current])}>
                  {current}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-36 p-1" onClick={e => e.stopPropagation()}>
              {proposalStatuses.map(status => (
                <button
                  key={status}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize cursor-pointer',
                    'hover:bg-accent hover:text-accent-foreground',
                    status === current && 'font-medium',
                  )}
                  onClick={() => meta?.onUpdateStatus(row.original.id, status)}
                >
                  <CheckIcon className={cn('h-3.5 w-3.5 shrink-0', status === current ? 'opacity-100' : 'opacity-0')} />
                  <Badge className={cn('capitalize text-xs', PROPOSAL_STATUS_COLORS[status])}>
                    {status}
                  </Badge>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )
      },
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
