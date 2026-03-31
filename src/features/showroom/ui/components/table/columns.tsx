import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { EntityDeleteButton } from '@/shared/components/entity-actions/entity-delete-button'
import { EntityEditButton } from '@/shared/components/entity-actions/entity-edit-button'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { Badge } from '@/shared/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

export type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}

export interface ProjectTableMeta {
  activeRowId: string | null
  onDelete: (projectId: string) => void
  isDeleting: boolean
}

export function getColumns(): ColumnDef<ProjectRow>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => <SortableHeader column={column} label="Project" />,
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProjectTableMeta | undefined
        const isActive = meta?.activeRowId === row.original.id

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">{row.original.title}</p>
                  {row.original.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {row.original.description}
                    </p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {row.original.title}
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
              <EntityViewButton
                href={`${ROOTS.landing.portfolioProjects()}/${row.original.accessor}`}
                external
              />
              <EntityEditButton
                href={ROOTS.dashboard.showroom.byId(row.original.id)}
              />
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
      accessorKey: 'city',
      header: 'Location',
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
      header: 'Status',
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
      filterFn: (row, _columnId, filterValue) => {
        return String(row.original.isPublic) === filterValue
      },
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed',
      cell: ({ row }) => <DateCell dateString={row.original.completedAt} />,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => <DateCell dateString={row.original.createdAt} />,
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'tradeNames',
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, _columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) {
          return true
        }
        const rowTrades = row.original.tradeNames
        return filterValue.some(trade => rowTrades.includes(trade))
      },
      meta: { hidden: true },
    },
  ]
}
