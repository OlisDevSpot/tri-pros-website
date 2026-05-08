'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { ProposalStatus } from '@/shared/constants/enums'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { EyeIcon, PlusIcon } from 'lucide-react'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { proposalStatuses } from '@/shared/constants/enums'
import { PROPOSAL_STATUS_COLORS } from '@/shared/entities/proposals/constants/proposal-status-colors'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { formatDateCell, formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

export type ProposalRow = AppRouterOutputs['proposalsRouter']['crud']['list']['rows'][number]

export interface ProposalTableMeta {
  proposalActions?: (row: ProposalRow) => EntityActionConfig<ProposalRow>[]
  onUpdateCreatedAt?: (proposalId: string, date: Date) => void
  onUpdateStatus?: (proposalId: string, status: ProposalStatus) => void
  onViewProfile?: (customerId: string) => void
}

export const PROPOSAL_COLUMNS = {
  label: {
    label: 'Proposal',
    sortable: true,
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProposalTableMeta | undefined
      const { customerName, customerId } = row.original
      const canOpenProfile = Boolean(customerName && customerId)
      return (
        <PrimaryCell
          entity={row.original}
          actions={meta?.proposalActions?.(row.original)}
          title={(
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-medium leading-tight text-foreground">{row.original.label}</p>
              {row.original.kind === 'additional-work' && (
                <HybridPopoverTooltip content="Addendum">
                  <span
                    className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/60"
                    aria-label="Addendum"
                  >
                    <PlusIcon className="size-2.5" strokeWidth={2.5} />
                  </span>
                </HybridPopoverTooltip>
              )}
            </div>
          )}
          subtitle={canOpenProfile
            ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    meta?.onViewProfile?.(customerId!)
                  }}
                  className={cn(
                    'block max-w-full truncate text-left text-xs text-muted-foreground',
                    'underline decoration-dotted decoration-muted-foreground/40 underline-offset-[3px]',
                    'transition-colors hover:text-foreground hover:decoration-foreground/60',
                    'focus-visible:text-foreground focus-visible:decoration-foreground/60 focus-visible:outline-none',
                    'cursor-pointer',
                  )}
                >
                  {customerName}
                </button>
              )
            : '—'}
        />
      )
    },
  },
  price: {
    label: 'Price',
    sortable: true,
    format: 'currency',
    accessorFn: row => computeFinalTcp(row.fundingJSON.data),
  },
  status: {
    label: 'Status',
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProposalTableMeta | undefined
      return (
        <StatusDropdownCell
          currentStatus={row.original.status}
          statuses={proposalStatuses}
          colorMap={PROPOSAL_STATUS_COLORS}
          onChange={status => meta?.onUpdateStatus?.(row.original.id, status)}
        />
      )
    },
  },
  createdAt: {
    label: 'Created',
    sortable: true,
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProposalTableMeta | undefined
      const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
      return (
        <div className="max-w-40" onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(row.original.createdAt)}
            onChange={(date) => {
              if (date) {
                meta?.onUpdateCreatedAt?.(row.original.id, date)
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
  },
  sentAt: {
    label: 'Sent',
    sortable: true,
    format: 'date',
  },
  viewCount: {
    label: 'Seen',
    sortable: true,
    headerIcon: EyeIcon,
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
  },
} as const satisfies ColumnRegistry<ProposalRow>
