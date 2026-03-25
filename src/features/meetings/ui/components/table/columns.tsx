import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingOutcome } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { MoreHorizontal } from 'lucide-react'

import { MEETING_OUTCOME_COLORS } from '@/features/meetings/constants/status-colors'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { StatusDropdownCell } from '@/shared/components/data-table/ui/status-dropdown-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityStartButton } from '@/shared/components/entity-actions/entity-start-button'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { meetingOutcomes } from '@/shared/constants/enums'
import { formatDateCell } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

export interface MeetingTableMeta {
  activeRowId: string | null
  userRole: string | undefined
  onEdit: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onViewProfile: (customerId: string) => void
  isDuplicating: boolean
  isDeleting: boolean
}

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function getColumns(): ColumnDef<MeetingRow>[] {
  return [
    {
      accessorKey: 'meetingType',
      header: ({ column }) => <SortableHeader column={column} label="Meeting" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        const isActive = meta?.activeRowId === row.original.id
        const selectedProgram = row.original.flowStateJSON?.selectedProgram ?? null
        const meetingLabel = selectedProgram ?? row.original.meetingType

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">{meetingLabel}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.original.customerName ?? '—'}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {meetingLabel}
                {' — '}
                {row.original.customerName ?? 'No customer'}
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
              <EntityStartButton onClick={() => meta?.onStart(row.original.id)} />
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
