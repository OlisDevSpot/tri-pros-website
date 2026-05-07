import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { AppRouter } from '@/trpc/routers/app'

import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

export type ProjectRow = inferRouterOutputs<AppRouter>['projectsRouter']['crud']['list']['rows'][number]

export interface ProjectTableMeta {
  projectActions: (row: ProjectRow) => EntityActionConfig<ProjectRow>[]
}

export function getColumns(): ColumnDef<ProjectRow>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => <SortableHeader column={column} label="Project" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProjectTableMeta | undefined

        return (
          <PrimaryCell
            entity={row.original}
            actions={meta?.projectActions(row.original)}
            title={row.original.title}
            subtitle={row.original.description ?? undefined}
            tooltipContent={row.original.title}
          />
        )
      },
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <SortableHeader column={column} label="Location" />,
      meta: { displayName: 'Location' },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-40 block">
          {row.original.state
            ? `${row.original.city}, ${row.original.state}`
            : row.original.city}
        </span>
      ),
    },
    {
      accessorKey: 'isPublic',
      header: ({ column }) => <SortableHeader column={column} label="Visibility" />,
      meta: { displayName: 'Visibility' },
      cell: ({ row }) => (
        <Badge
          className={cn(
            'text-xs',
            row.original.isPublic
              ? 'bg-emerald-500/15 text-emerald-700'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {row.original.isPublic ? 'Public' : 'Draft'}
        </Badge>
      ),
    },
    {
      accessorKey: 'completedAt',
      header: ({ column }) => <SortableHeader column={column} label="Completed" />,
      meta: { displayName: 'Completed' },
      cell: ({ row }) => <DateCell dateString={row.original.completedAt} />,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      meta: { displayName: 'Created' },
      cell: ({ row }) => <DateCell dateString={row.original.createdAt} />,
      sortingFn: 'datetime',
    },
  ]
}
