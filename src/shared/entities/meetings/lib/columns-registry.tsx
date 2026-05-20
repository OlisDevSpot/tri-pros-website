'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { meetingOutcomes } from '@/shared/constants/enums'
import { getOutcomeDisabledChecker } from '@/shared/domains/pipelines/lib/get-disabled-outcomes'
import { ParticipantPicker, ReadOnlyParticipantSummary } from '@/shared/entities/meetings/components/participant-picker'
import { MEETING_OUTCOME_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatDateCell } from '@/shared/lib/formatters'

export type MeetingRow = AppRouterOutputs['meetingsRouter']['reads']['list']['rows'][number]

export interface MeetingTableMeta {
  meetingActions?: (row: MeetingRow) => EntityActionConfig<MeetingRow>[]
  onUpdateOutcome?: (meetingId: string, outcome: MeetingOutcome) => void
  onUpdateScheduledFor?: (meetingId: string, date: Date) => void
  onAssignRep?: (meetingId: string, currentOwnerId: string) => void
  canAssignMeeting?: boolean
}

export const MEETING_COLUMNS = {
  customerName: {
    label: 'Meeting',
    sortable: true,
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      const selectedProgram = row.original.flowStateJSON?.selectedProgram ?? null
      const meetingLabel = selectedProgram ?? row.original.meetingType
      return (
        <PrimaryCell
          entity={row.original}
          actions={meta?.meetingActions?.(row.original)}
          title={row.original.customerName ?? '—'}
          subtitle={meetingLabel}
          tooltipContent={`${row.original.customerName ?? 'No customer'} — ${meetingLabel}`}
        />
      )
    },
  },
  meetingOutcome: {
    label: 'Outcome',
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
    cell: ({ row, table }) => {
      const meta = table.options.meta as MeetingTableMeta | undefined
      // Owner + co-owner come from the table query (joined via the
      // meetingParticipants junction). Passing them as initial data lets
      // the picker / read-only summary skip the per-row getParticipants
      // fetch on table mount.
      const initialOwner = row.original.owner
      const initialCoOwner = row.original.coOwner

      if (!meta?.canAssignMeeting) {
        // Read-only fallback: no popover means no need for stopPropagation —
        // row click should still navigate as normal.
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
    sortable: true,
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
} as const satisfies ColumnRegistry<MeetingRow>
