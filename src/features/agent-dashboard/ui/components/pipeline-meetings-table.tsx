'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MeetingPipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { ArrowUpDownIcon, ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'

import { MEETING_STATUS_COLORS } from '@/features/meetings/constants/status-colors'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  meeting_set: 'in_progress',
  meeting_done: 'completed',
  meeting_converted: 'converted',
}

const columns: ColumnDef<MeetingPipelineItem>[] = [
  {
    accessorKey: 'customerName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Customer
        <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-none truncate">{row.original.customerName}</p>
          {row.original.program && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.original.program}</p>
          )}
        </div>
        <Button asChild size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/dashboard/meetings/${row.original.id}`}>
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Open</span>
          </Link>
        </Button>
      </div>
    ),
  },
  {
    accessorKey: 'stage',
    header: 'Status',
    cell: ({ row }) => {
      const status = STATUS_LABEL[row.original.stage] ?? row.original.stage
      const colorKey = status as keyof typeof MEETING_STATUS_COLORS
      return (
        <Badge className={cn('capitalize text-xs', MEETING_STATUS_COLORS[colorKey])}>
          {status.replace('_', ' ')}
        </Badge>
      )
    },
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
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground tabular-nums">
        {formatStringAsDate(row.original.createdAt)}
      </span>
    ),
    sortingFn: 'datetime',
  },
]

interface Props {
  data: MeetingPipelineItem[]
}

export function PipelineMeetingsTable({ data }: Props) {
  return (
    <DataTable
      data={data}
      columns={columns}
      defaultSort={[{ id: 'createdAt', desc: true }]}
      entityName="meeting"
      pageSize={12}
    />
  )
}
