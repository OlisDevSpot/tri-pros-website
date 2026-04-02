import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingOutcome } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { MEETING_OUTCOME_COLORS } from '@/features/meetings/constants/status-colors'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { MEETING_ACTIONS } from '@/shared/components/entity-actions/constants/meeting-actions'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { meetingOutcomes } from '@/shared/constants/enums'
import { formatDateCell } from '@/shared/lib/formatters'

export interface MeetingTableMeta {
  userRole: string | undefined
  onView: (meetingId: string, customerId: string | null) => void
  onEdit: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onAssignOwner: (meetingId: string, currentOwnerId: string) => void
  onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onViewProfile: (customerId: string, meetingId?: string) => void
  isDuplicating: boolean
  isDeleting: boolean
}

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

function buildMeetingActions(row: MeetingRow, meta: MeetingTableMeta) {
  return [
    { action: MEETING_ACTIONS.view, onAction: () => meta.onView(row.id, row.customerId) },
    { action: MEETING_ACTIONS.start, onAction: () => meta.onStart(row.id) },
    { action: MEETING_ACTIONS.edit, onAction: () => meta.onEdit(row.id) },
    { action: MEETING_ACTIONS.duplicate, onAction: () => meta.onDuplicate(row.id), isLoading: meta.isDuplicating },
    { action: MEETING_ACTIONS.assignOwner, onAction: () => meta.onAssignOwner(row.id, row.ownerId) },
    { action: MEETING_ACTIONS.delete, onAction: () => meta.onDelete(row.id), isLoading: meta.isDeleting },
  ]
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
                actions={buildMeetingActions(row.original, meta)}
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
            statuses={meetingOutcomes}
            colorMap={MEETING_OUTCOME_COLORS}
            onChange={outcome => meta?.onUpdateOutcome(row.original.id, outcome)}
          />
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
