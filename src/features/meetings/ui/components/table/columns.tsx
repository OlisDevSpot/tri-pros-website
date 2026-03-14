import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingStatus } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { ArrowUpDownIcon, CheckIcon, CopyIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react'

import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { MEETING_STATUS_COLORS } from '@/features/meetings/constants/status-colors'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
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
  isDuplicating: boolean
  isDeleting: boolean
}

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function getColumns(): ColumnDef<MeetingRow>[] {
  return [
    {
      accessorKey: 'contactName',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Meeting
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
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
                'flex items-center gap-1 shrink-0 opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100',
                isActive && 'opacity-100',
              )}
              onClick={e => e.stopPropagation()}
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => meta?.onEdit(row.original.id)}
              >
                <PencilIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Edit setup</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={meta?.isDuplicating}
                onClick={() => meta?.onDuplicate(row.original.id)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Duplicate</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => meta?.onStart(row.original.id)}
              >
                <PlayIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Start meeting</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={meta?.isDeleting}
                onClick={() => meta?.onDelete(row.original.id)}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-40 block">
          {row.original.customerName ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        const current = row.original.status

        return (
          <Popover>
            <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
              <button type="button" className="cursor-pointer">
                <Badge className={cn('capitalize text-xs', MEETING_STATUS_COLORS[current])}>
                  {current.replace('_', ' ')}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 p-1" onClick={e => e.stopPropagation()}>
              {meetingStatuses.map(status => (
                <button
                  key={status}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize cursor-pointer',
                    'hover:bg-accent hover:text-accent-foreground',
                    status === current && 'font-medium',
                  )}
                  onClick={() => meta?.onUpdateStatus(row.original.id, status)}
                >
                  <CheckIcon className={cn('h-3.5 w-3.5 shrink-0', status === current ? 'opacity-100' : 'opacity-0')} />
                  <Badge className={cn('capitalize text-xs', MEETING_STATUS_COLORS[status])}>
                    {status.replace('_', ' ')}
                  </Badge>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )
      },
    },
    {
      accessorKey: 'scheduledFor',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Scheduled For
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Created
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row }) => {
        const { relative, dayAtTime } = formatDateCell(row.original.createdAt)

        return (
          <div className="flex flex-col max-w-40">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground">{dayAtTime}</span>
          </div>
        )
      },
      sortingFn: 'datetime',
    },
  ]
}
