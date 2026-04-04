import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { UserIcon } from 'lucide-react'

import { MEETING_OUTCOME_COLORS, MEETING_OUTCOME_LABELS } from '@/features/meetings/constants/status-colors'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { visibleMeetingOutcomes } from '@/shared/constants/enums'
import { formatDateCell } from '@/shared/lib/formatters'
import { getOutcomeDisabledChecker } from '@/shared/pipelines/lib/get-disabled-outcomes'

export type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export interface MeetingTableMeta {
  meetingActions: (row: MeetingRow) => EntityActionConfig<MeetingRow>[]
  onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onAssignRep: (meetingId: string, currentOwnerId: string) => void
}

export function getColumns(): ColumnDef<MeetingRow>[] {
  return [
    {
      accessorKey: 'customerName',
      header: ({ column }) => <SortableHeader column={column} label="Meeting" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        const selectedProgram = row.original.flowStateJSON?.selectedProgram ?? null
        const meetingLabel = selectedProgram ?? row.original.meetingType

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">
                    {row.original.customerName ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{meetingLabel}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {row.original.customerName ?? 'No customer'}
                {' — '}
                {meetingLabel}
              </TooltipContent>
            </Tooltip>
            {meta && (
              <EntityActionMenu
                entity={row.original}
                actions={meta.meetingActions(row.original)}
                mode="compact"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'meetingOutcome',
      header: 'Outcome',
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        return (
          <StatusDropdownCell
            currentStatus={row.original.meetingOutcome}
            statuses={visibleMeetingOutcomes}
            colorMap={MEETING_OUTCOME_COLORS}
            formatLabel={status => MEETING_OUTCOME_LABELS[status] ?? status.replace(/_/g, ' ')}
            isStatusDisabled={getOutcomeDisabledChecker({
              proposalCount: row.original.proposalCount ?? 0,
              hasSentProposal: row.original.hasSentProposal ?? false,
              hasApprovedProposal: row.original.hasApprovedProposal ?? false,
            })}
            onChange={outcome => meta?.onUpdateOutcome(row.original.id, outcome)}
          />
        )
      },
    },
    {
      accessorKey: 'ownerName',
      header: 'Rep',
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        const name = row.original.ownerName

        return (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors duration-150 hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation()
              meta?.onAssignRep(row.original.id, row.original.ownerId)
            }}
          >
            <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-24">{name ?? 'Unassigned'}</span>
          </button>
        )
      },
    },
    {
      accessorKey: 'scheduledFor',
      header: ({ column }) => <SortableHeader column={column} label="Scheduled For" />,
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
                    meta?.onUpdateScheduledFor(row.original.id, date)
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
                  meta?.onUpdateScheduledFor(row.original.id, date)
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
  ]
}
