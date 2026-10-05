'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { SortId } from '@/shared/dal/lib/query/field-list'
import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { meetingOutcomes } from '@/shared/constants/enums'
import { getOutcomeDisabledChecker } from '@/shared/domains/pipelines/lib/get-disabled-outcomes'
import { LeadSourceOverviewCard } from '@/shared/entities/lead-sources/components/overview-card'
import { MeetingCustomerCell } from '@/shared/entities/meetings/components/meeting-customer-cell'
import { ParticipantPicker, ReadOnlyParticipantSummary } from '@/shared/entities/meetings/components/participant-picker'
import { MEETING_OUTCOME_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatDateCell } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_STATUS_DOT_COLORS } from '@/shared/modules/proposals/core/constants/proposal-status-colors'

export type MeetingRow = AppRouterOutputs['meetingsRouter']['reads']['list']['rows'][number]

export interface MeetingTableMeta extends EntityTableMeta<MeetingRow> {
  onUpdateOutcome?: (meetingId: string, outcome: MeetingOutcome) => void
  onUpdateScheduledFor?: (meetingId: string, date: Date) => void
  onAssignRep?: (meetingId: string, currentOwnerId: string) => void
  canAssignMeeting?: boolean
  onViewProfile?: (customerId: string) => void
}

export const MEETING_COLUMNS = {
  customerName: {
    label: 'Meeting',
    size: 420,
    sort: 'customerName',
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      return (
        <MeetingCustomerCell
          meeting={row.original}
          actions={meta?.rowActions}
          onViewProfile={meta?.onViewProfile}
        />
      )
    },
  },
  meetingType: {
    label: 'Meeting type',
    size: 130,
    sort: 'meetingType',
  },
  meetingOutcome: {
    label: 'Outcome',
    sort: 'outcome',
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      return (
        <StatusDropdownCell
          currentStatus={row.original.meetingOutcome}
          statuses={meetingOutcomes}
          colorMap={MEETING_OUTCOME_COLORS}
          formatLabel={status => MEETING_OUTCOME_LABELS[status] ?? status.replace(/_/g, ' ')}
          isStatusDisabled={getOutcomeDisabledChecker({
            proposalCount: row.original.proposalCount ?? 0,
            hasSentProposal: row.original.hasSentProposal ?? false,
            hasApprovedProposal: row.original.hasApprovedProposal ?? false,
          })}
          onChange={outcome => meta?.onUpdateOutcome?.(row.original.id, outcome as MeetingOutcome)}
        />
      )
    },
  },
  ownerName: {
    label: 'Rep',
    sort: 'rep',
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      // Owner + co-owner come from the table query (joined via the
      // meetingParticipants junction). Passing them as initial data lets
      // the picker / read-only summary skip the per-row getParticipants
      // fetch on table mount.
      const initialOwner = row.original.owner
      const initialCoOwner = row.original.coOwner

      if (!meta?.canAssignMeeting) {
        // Read-only fallback: no popover, so the click is left to the row.
        return (
          <ReadOnlyParticipantSummary
            meetingId={row.original.id}
            variant="compact"
            initialOwner={initialOwner}
            initialCoOwner={initialCoOwner}
          />
        )
      }
      const onAssign = meta.onAssignRep
      return (
        <div onClick={e => e.stopPropagation()}>
          <ParticipantPicker
            meetingId={row.original.id}
            variant="compact"
            initialOwner={initialOwner}
            initialCoOwner={initialCoOwner}
            onManageClick={() => onAssign?.(row.original.id, row.original.ownerId)}
          />
        </div>
      )
    },
  },
  scheduledFor: {
    label: 'Scheduled For',
    sort: 'scheduledFor',
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      const dateStr = row.original.scheduledFor
      if (!dateStr) {
        return (
          <div className="max-w-40" onClick={e => e.stopPropagation()}>
            <DateTimePicker
              value={undefined}
              onChange={(date) => {
                if (date) {
                  meta?.onUpdateScheduledFor?.(row.original.id, date)
                }
              }}
              placeholder="Set date"
            />
          </div>
        )
      }
      const { relative, dayAtTime } = formatDateCell(dateStr)
      return (
        <div className="max-w-40" onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(dateStr)}
            onChange={(date) => {
              if (date) {
                meta?.onUpdateScheduledFor?.(row.original.id, date)
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
  createdAt: {
    label: 'Booked on',
    format: 'date',
    sort: 'createdAt',
    defaultHidden: true,
  },
  tradeSelections: {
    label: 'Trades',
    accessorFn: row => row.flowStateJSON?.tradeSelections?.length ?? 0,
    cell: ({ row }) => {
      const selections = row.original.flowStateJSON?.tradeSelections ?? []
      const [first, ...rest] = selections
      if (!first) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm">{first.tradeName}</span>
          {rest.length > 0 && (
            <HybridPopoverTooltip
              content={(
                <ul className="flex flex-col gap-1.5">
                  {selections.map(selection => (
                    <li key={selection.tradeId}>
                      <span className="font-medium">{selection.tradeName}</span>
                      {selection.selectedScopes.length > 0 && (
                        <span className="block text-xs opacity-80">
                          {selection.selectedScopes.map(scope => scope.label).join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            >
              <span tabIndex={0} className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {`+${rest.length}`}
              </span>
            </HybridPopoverTooltip>
          )}
        </div>
      )
    },
  },
  leadSource: {
    label: 'Lead source',
    sort: 'leadSource',
    accessorFn: row => row.leadSource?.name ?? '',
    cell: ({ row }) => {
      const source = row.original.leadSource
      if (!source) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <LeadSourceOverviewCard
          source={source}
          className="min-h-0 w-auto gap-2 rounded-none p-0 hover:bg-transparent focus-visible:bg-transparent sm:min-h-0"
        >
          <LeadSourceOverviewCard.Name className="font-normal" />
        </LeadSourceOverviewCard>
      )
    },
  },
  proposalStatuses: {
    label: 'Proposals',
    accessorFn: row => row.proposalStatuses.length,
    cell: ({ row }) => {
      const statuses = row.original.proposalStatuses
      if (statuses.length === 0) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex items-center gap-1">
            {statuses.map((status, index) => (
              // eslint-disable-next-line react/no-array-index-key -- one dot per proposal in created order; statuses repeat
              <span key={index} className={cn('size-2 rounded-full', PROPOSAL_STATUS_DOT_COLORS[status])} />
            ))}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">{statuses.length}</span>
          <span className="sr-only">{statuses.join(', ')}</span>
        </div>
      )
    },
  },
} as const satisfies ColumnRegistry<MeetingRow, SortId<typeof MEETING_FIELDS>>

export type MeetingColumnKey = keyof typeof MEETING_COLUMNS
