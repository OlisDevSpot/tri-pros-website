import type { ColumnDef } from '@tanstack/react-table'
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon } from 'lucide-react'

import { activeStageConfig } from '@/features/customer-pipelines/constants/active-pipeline-stages'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { Badge } from '@/shared/components/ui/badge'

export const STAGE_BADGE_COLORS: Record<string, string> = {
  meeting_scheduled: 'bg-blue-500/10 text-blue-600',
  meeting_in_progress: 'bg-yellow-500/10 text-yellow-600',
  meeting_completed: 'bg-yellow-500/10 text-yellow-600',
  follow_up_scheduled: 'bg-purple-500/10 text-purple-600',
  proposal_sent: 'bg-purple-500/10 text-purple-600',
  contract_sent: 'bg-purple-500/10 text-purple-600',
  approved: 'bg-green-500/10 text-green-600',
  declined: 'bg-red-500/10 text-red-600',
}

export interface PipelineTableMeta {
  onViewProfile: (customerId: string) => void
}

export function getPipelineColumns(): ColumnDef<CustomerPipelineItem>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Customer',
      cell: ({ row, table }) => {
        const meta = table.options.meta as PipelineTableMeta | undefined
        return (
          <CustomerNameCell
            customerId={row.original.id}
            customerName={row.original.name}
            onViewProfile={meta?.onViewProfile}
          />
        )
      },
    },
    {
      accessorKey: 'stage',
      header: 'Stage',
      cell: ({ row }) => {
        const config = activeStageConfig.find(s => s.key === row.original.stage)
        return (
          <Badge variant="secondary" className={STAGE_BADGE_COLORS[row.original.stage] ?? ''}>
            {config?.label ?? row.original.stage}
          </Badge>
        )
      },
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue || filterValue === 'all') {
          return true
        }
        return row.original.stage === filterValue
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
}
