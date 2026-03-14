import type { ColumnDef } from '@tanstack/react-table'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { ArrowUpDownIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { ROOTS } from '@/shared/config/roots'
import { formatDateCell } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number]

export interface ProjectTableMeta {
  onDelete: (projectId: string) => void
  isDeleting: boolean
}

export function getColumns(): ColumnDef<ProjectRow>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Project
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row, table }) => {
        const meta = table.options.meta as ProjectTableMeta | undefined

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
                'flex items-center gap-1 shrink-0 opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100',
              )}
              onClick={e => e.stopPropagation()}
            >
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <a
                  href={`/portfolio/${row.original.accessor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">View</span>
                </a>
              </Button>
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <Link href={`${ROOTS.dashboard()}?step=edit-project&editProjectId=${row.original.id}`}>
                  <PencilIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit</span>
                </Link>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={meta?.isDeleting}
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (window.confirm('Are you sure you want to delete this project?')) {
                    meta?.onDelete(row.original.id)
                  }
                }}
              >
                <Trash2Icon className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
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
      cell: ({ row }) => {
        const dateStr = row.original.completedAt
        if (!dateStr) {
          return <span className="text-sm text-muted-foreground">&mdash;</span>
        }
        const { relative, dayAtTime } = formatDateCell(dateStr)

        return (
          <div className="flex flex-col max-w-40">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground">{dayAtTime}</span>
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
