import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { ProposalStatus } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { EyeIcon } from 'lucide-react'

import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { PROPOSAL_ACTIONS } from '@/shared/components/entity-actions/constants/proposal-actions'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { ROOTS } from '@/shared/config/roots'
import { proposalStatuses } from '@/shared/constants/enums'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { formatDateCell, formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type ProposalRow = inferRouterOutputs<AppRouter>['proposalsRouter']['getProposals'][number]

export interface ProposalTableMeta {
  userRole: string | undefined
  onDuplicate: (proposalId: string) => void
  onDelete: (proposalId: string) => void
  isDuplicating: boolean
  isDeleting: boolean
  onUpdateCreatedAt: (proposalId: string, date: Date) => void
  onUpdateStatus: (proposalId: string, status: ProposalStatus) => void
  onViewProfile: (customerId: string) => void
}

function buildShareableUrl(proposalId: string, token: string | null, utmSource: 'email' | 'sms'): string {
  const base = `${ROOTS.public.proposals({ absolute: true, isProduction: true })}/proposal/${proposalId}`
  const params = new URLSearchParams()
  if (token) {
    params.set('token', token)
  }
  params.set('utm_source', utmSource)
  return `${base}?${params.toString()}`
}

function buildProposalActions(row: ProposalRow, meta: ProposalTableMeta) {
  return [
    {
      action: PROPOSAL_ACTIONS.view,
      onAction: () => window.open(`${ROOTS.public.proposals()}/proposal/${row.id}`, '_blank'),
    },
    {
      action: PROPOSAL_ACTIONS.edit,
      onAction: () => { window.location.href = ROOTS.dashboard.proposals.byId(row.id) },
    },
    {
      action: PROPOSAL_ACTIONS.shareByEmail,
      onAction: () => copyToClipboard(buildShareableUrl(row.id, row.token, 'email'), 'Proposal link (email)'),
    },
    {
      action: PROPOSAL_ACTIONS.shareBySms,
      onAction: () => copyToClipboard(buildShareableUrl(row.id, row.token, 'sms'), 'Proposal link (SMS)'),
    },
    {
      action: PROPOSAL_ACTIONS.duplicate,
      onAction: () => meta.onDuplicate(row.id),
      isLoading: meta.isDuplicating,
    },
    {
      action: PROPOSAL_ACTIONS.delete,
      onAction: () => meta.onDelete(row.id),
      isLoading: meta.isDeleting,
    },
  ]
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
                actions={buildProposalActions(row.original, meta)}
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
