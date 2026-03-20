import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { ProposalStatus } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { CopyIcon, EyeIcon, MoreHorizontal, TrashIcon } from 'lucide-react'
import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { ROOTS } from '@/shared/config/roots'
import { proposalStatuses } from '@/shared/constants/enums'
import { formatDateCell, formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalsRouter']['getProposals'][number]

export interface ProposalTableMeta {
  activeRowId: string | null
  userRole: string | undefined
  onDuplicate: (proposalId: string) => void
  onDelete: (proposalId: string) => void
  isDuplicating: boolean
  isDeleting: boolean
  onUpdateCreatedAt: (proposalId: string, date: Date) => void
  onUpdateStatus: (proposalId: string, status: ProposalStatus) => void
  onViewProfile: (customerId: string) => void
}

export function getColumns(): ColumnDef<ProposalRow>[] {
  return [
    {
      accessorKey: 'label',
      header: ({ column }) => <SortableHeader column={column} label="Proposal" />,
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
                    {row.original.customerName ?? '—'}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {row.original.label}
              </TooltipContent>
            </Tooltip>
            <div
              className={cn(
                'flex items-center gap-1 shrink-0 opacity-0 pointer-events-none transition-opacity duration-150',
                'group-hover:opacity-100 group-hover:pointer-events-auto',
                isActive && 'opacity-100 pointer-events-auto',
              )}
              onClick={e => e.stopPropagation()}
            >
              <EntityViewButton
                href={`${ROOTS.public.proposals()}/proposal/${row.original.id}`}
                external
              />
              <EntityEditButton
                href={`${ROOTS.dashboard.root}?step=edit-proposal&proposalId=${row.original.id}`}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={meta?.isDuplicating}
                    onClick={() => meta?.onDuplicate(row.original.id)}
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                  {meta?.userRole === 'super-admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={meta?.isDeleting}
                        className="text-destructive focus:text-destructive"
                        onClick={() => meta?.onDelete(row.original.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        return (
          <CustomerNameCell
            customerId={row.original.customerId}
            customerName={row.original.customerName}
            onViewProfile={meta?.onViewProfile}
          />
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        return (
          <StatusDropdownCell
            currentStatus={row.original.status}
            statuses={proposalStatuses}
            colorMap={PROPOSAL_STATUS_COLORS}
            onChange={status => meta?.onUpdateStatus(row.original.id, status)}
          />
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        const { relative, dayAtTime } = formatDateCell(row.original.createdAt)

        return (
          <div className="max-w-40" onClick={e => e.stopPropagation()}>
            <DateTimePicker
              value={new Date(row.original.createdAt)}
              onChange={(date) => {
                if (date) {
                  meta?.onUpdateCreatedAt(row.original.id, date)
                }
              }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{relative}</span>
                <span className="text-xs text-muted-foreground">{dayAtTime}</span>
              </div>
            </DateTimePicker>
          </div>
        )
      },
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'sentAt',
      header: ({ column }) => <SortableHeader column={column} label="Sent" />,
      cell: ({ row }) => <DateCell dateString={row.original.sentAt} />,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'viewCount',
      header: ({ column }) => <SortableHeader column={column} label="Seen" icon={EyeIcon} />,
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
