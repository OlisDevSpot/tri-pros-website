'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

export type ProjectRow = AppRouterOutputs['projectsRouter']['crud']['list']['rows'][number]

export interface ProjectTableMeta {
  projectActions?: (row: ProjectRow) => EntityActionConfig<ProjectRow>[]
}

export const PROJECT_COLUMNS = {
  title: {
    label: 'Project',
    sort: 'title',
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProjectTableMeta | undefined
      return (
        <PrimaryCell
          entity={row.original}
          actions={meta?.projectActions?.(row.original)}
          title={row.original.title}
          subtitle={row.original.description ?? undefined}
          tooltipContent={row.original.title}
        />
      )
    },
  },
  city: {
    label: 'Location',
    sort: 'city',
    cell: ({ row }) => (
      <span className="block truncate max-w-40 text-sm text-muted-foreground">
        {row.original.state
          ? `${row.original.city}, ${row.original.state}`
          : row.original.city}
      </span>
    ),
  },
  isPublic: {
    label: 'Visibility',
    sort: 'isPublic',
    cell: ({ row }) => (
      <Badge
        className={cn(
          'text-xs',
          row.original.isPublic
            ? 'bg-status-success-bg text-status-success-fg'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {row.original.isPublic ? 'Public' : 'Draft'}
      </Badge>
    ),
  },
  completedAt: {
    label: 'Completed',
    sort: 'completedAt',
    format: 'date',
  },
  createdAt: {
    label: 'Created',
    sort: 'createdAt',
    format: 'date',
  },
} as const satisfies ColumnRegistry<ProjectRow>
