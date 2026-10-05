'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'
import type { SortId } from '@/shared/dal/lib/query/field-list'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { Badge } from '@/shared/components/ui/badge'
import { deriveProjectStatusBucket } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { PROJECT_STATUS_BUCKET_COLORS } from '@/shared/modules/projects/core/constants/status-colors'
import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

export type ProjectRow = AppRouterOutputs['projectsRouter']['crud']['list']['rows'][number]

export interface ProjectTableMeta extends EntityTableMeta<ProjectRow> {
  onViewProfile?: (customerId: string) => void
}

export const PROJECT_COLUMNS = {
  title: {
    label: 'Project',
    size: 260,
    sort: 'title',
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProjectTableMeta | undefined
      return (
        <PrimaryCell
          entity={row.original}
          actions={meta?.rowActions}
          title={row.original.title}
          subtitle={row.original.description ?? undefined}
          tooltipContent={row.original.title}
        />
      )
    },
  },
  customerName: {
    label: 'Customer',
    sort: 'customerName',
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProjectTableMeta | undefined
      return (
        <CustomerNameCell
          customerId={row.original.customerId}
          customerName={row.original.customerName}
          onViewProfile={meta?.onViewProfile}
          className="max-w-48 text-sm text-foreground"
        />
      )
    },
  },
  status: {
    label: 'Status',
    // The bucket is derived from the stage; the Status filter covers "show me On Hold".
    cell: ({ row }) => {
      const bucket = deriveProjectStatusBucket(row.original.pipelineStage)
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge className={cn('shrink-0 text-xs', PROJECT_STATUS_BUCKET_COLORS[bucket])}>{PROJECT_STATUS_BUCKET_LABELS[bucket]}</Badge>
          {row.original.pipelineStage && (
            <span className="truncate text-xs capitalize text-muted-foreground">{row.original.pipelineStage.replace(/_/g, ' ')}</span>
          )}
        </div>
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
    sort: 'visibility',
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
} as const satisfies ColumnRegistry<ProjectRow, SortId<typeof PROJECT_FIELDS>>

export type ProjectColumnKey = keyof typeof PROJECT_COLUMNS
