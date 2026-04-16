import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { formatDateCell } from '@/shared/lib/formatters'

export type ActivityRow = inferRouterOutputs<AppRouter>['scheduleRouter']['activities']['getAll'][number]

export const ACTIVITY_DEFAULT_SORT = [{ id: 'scheduledFor', desc: true }]

export function getActivityColumns(): ColumnDef<ActivityRow>[] {
  return [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="capitalize text-sm">{row.original.type}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: ({ column }) => <SortableHeader column={column} label="Title" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-sm truncate max-w-60">{row.original.title}</p>
        </div>
      ),
    },
    {
      accessorKey: 'entityType',
      header: 'Entity',
      cell: ({ row }) => (
        <span className="capitalize text-sm text-muted-foreground">
          {row.original.entityType ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'scheduledFor',
      header: ({ column }) => <SortableHeader column={column} label="Scheduled For" />,
      cell: ({ row }) => {
        const dateStr = row.original.scheduledFor
        if (!dateStr) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const { relative, dayAtTime } = formatDateCell(dateStr)
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground">{dayAtTime}</span>
          </div>
        )
      },
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'dueAt',
      header: ({ column }) => <SortableHeader column={column} label="Due" />,
      cell: ({ row }) => {
        const dateStr = row.original.dueAt
        if (!dateStr) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const { relative, dayAtTime } = formatDateCell(dateStr)
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground">{dayAtTime}</span>
          </div>
        )
      },
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'completedAt',
      header: 'Status',
      cell: ({ row }) => {
        const completedAt = row.original.completedAt
        if (completedAt) {
          return (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              Done
            </span>
          )
        }
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Open
          </span>
        )
      },
    },
    {
      accessorKey: 'ownerName',
      header: 'Owner',
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-32">
          {row.original.ownerName ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => {
        const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground">{dayAtTime}</span>
          </div>
        )
      },
      sortingFn: 'datetime',
    },
  ]
}
