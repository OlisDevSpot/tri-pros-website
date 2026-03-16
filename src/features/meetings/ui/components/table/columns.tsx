import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingStatus } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { MEETING_STATUS_COLORS } from '@/features/meetings/constants/status-colors'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityDeleteButton } from '@/shared/components/entity-actions/entity-delete-button'
import { EntityDuplicateButton } from '@/shared/components/entity-actions/entity-duplicate-button'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityStartButton } from '@/shared/components/entity-actions/entity-start-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { meetingStatuses } from '@/shared/constants/enums'
import { formatDateCell } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

export interface MeetingTableMeta {
  activeRowId: string | null
  onEdit: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onUpdateStatus: (meetingId: string, status: MeetingStatus) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onViewProfile: (customerId: string) => void
  isDuplicating: boolean
  isDeleting: boolean
}

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function getColumns(): ColumnDef<MeetingRow>[] {
  return [
    {
      accessorKey: 'contactName',
      header: ({ column }) => <SortableHeader column={column} label="Meeting" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        const isActive = meta?.activeRowId === row.original.id
        const programName = row.original.program
          ? MEETING_PROGRAMS.find(p => p.accessor === row.original.program)?.name ?? row.original.program
          : 'No program selected'

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">{programName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.original.contactName ?? '—'}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {programName}
                {' — '}
                {row.original.contactName ?? 'No contact'}
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
              <EntityEditButton onClick={() => meta?.onEdit(row.original.id)} />
              <EntityDuplicateButton
                disabled={meta?.isDuplicating}
                onClick={() => meta?.onDuplicate(row.original.id)}
              />
              <EntityStartButton onClick={() => meta?.onStart(row.original.id)} />
              <EntityDeleteButton
                disabled={meta?.isDeleting}
                onClick={() => meta?.onDelete(row.original.id)}
              />
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
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
        const meta = table.options.meta as MeetingTableMeta | undefined
        return (
          <StatusDropdownCell
            currentStatus={row.original.status}
            statuses={meetingStatuses}
            colorMap={MEETING_STATUS_COLORS}
            onChange={status => meta?.onUpdateStatus(row.original.id, status)}
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
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => <DateCell dateString={row.original.createdAt} />,
      sortingFn: 'datetime',
    },
  ]
}
