import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { ProposalStatus } from '@/shared/constants/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { EyeIcon } from 'lucide-react'

import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { proposalStatuses } from '@/shared/constants/enums'
import { formatDateCell, formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

export type ProposalRow = inferRouterOutputs<AppRouter>['proposalsRouter']['crud']['list']['rows'][number]

export interface ProposalTableMeta {
  proposalActions: (row: ProposalRow) => EntityActionConfig<ProposalRow>[]
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
            {meta && (
              <EntityActionMenu
                entity={row.original}
                actions={meta.proposalActions(row.original)}
                mode="compact"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProposalTableMeta | undefined
        const name = row.original.customerName
        if (!name) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <button
            type="button"
            className="text-sm text-blue-500 hover:underline cursor-pointer truncate max-w-40 block"
            onClick={(e) => {
              e.stopPropagation()
              if (row.original.customerId) {
                meta?.onViewProfile(row.original.customerId)
              }
            }}
          >
            {name}
          </button>
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
