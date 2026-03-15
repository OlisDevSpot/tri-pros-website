'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { CustomerPipelineItem } from '@/features/pipeline/types'

import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon } from 'lucide-react'

import { customerStageConfig } from '@/features/pipeline/constants/customer-pipeline-stages'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { Badge } from '@/shared/components/ui/badge'

const STAGE_BADGE_COLORS: Record<string, string> = {
  meeting_scheduled: 'bg-blue-500/10 text-blue-600',
  meeting_in_progress: 'bg-indigo-500/10 text-indigo-600',
  meeting_completed: 'bg-yellow-500/10 text-yellow-600',
  follow_up_scheduled: 'bg-purple-500/10 text-purple-600',
  proposal_sent: 'bg-orange-500/10 text-orange-600',
  contract_sent: 'bg-cyan-500/10 text-cyan-600',
  approved: 'bg-green-500/10 text-green-600',
  declined: 'bg-red-500/10 text-red-600',
}

const columns: ColumnDef<CustomerPipelineItem>[] = [
  {
    accessorKey: 'name',
    header: 'Customer',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'stage',
    header: 'Stage',
    cell: ({ row }) => {
      const config = customerStageConfig.find(s => s.key === row.original.stage)
      return (
        <Badge variant="secondary" className={STAGE_BADGE_COLORS[row.original.stage] ?? ''}>
          {config?.label ?? row.original.stage}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'totalPipelineValue',
    header: 'Pipeline Value',
    cell: ({ row }) => (
      <span className="font-semibold text-green-600 tabular-nums">
        {row.original.totalPipelineValue > 0
          ? `$${row.original.totalPipelineValue.toLocaleString()}`
          : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'meetingCount',
    header: 'Meetings',
    cell: ({ row }) => (
      <span className="flex items-center gap-1 text-muted-foreground">
        <CalendarIcon size={13} />
        {row.original.meetingCount}
      </span>
    ),
  },
  {
    accessorKey: 'proposalCount',
    header: 'Proposals',
    cell: ({ row }) => (
      <span className="flex items-center gap-1 text-muted-foreground">
        <FileTextIcon size={13} />
        {row.original.proposalCount}
      </span>
    ),
  },
  {
    accessorKey: 'latestActivityAt',
    header: 'Last Activity',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(row.original.latestActivityAt), { addSuffix: true })}
      </span>
    ),
  },
]

interface Props {
  data: CustomerPipelineItem[]
}

export function CustomerPipelineTable({ data }: Props) {
  return (
    <DataTable
      columns={columns}
      data={data}
    />
  )
}
