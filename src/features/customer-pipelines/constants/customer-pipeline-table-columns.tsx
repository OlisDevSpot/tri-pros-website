import type { ColumnDef } from '@tanstack/react-table'
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon } from 'lucide-react'

import { activeStageConfig } from '@/features/customer-pipelines/constants/active-pipeline-stages'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'

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
  customerActions: (row: CustomerPipelineItem) => EntityActionConfig<CustomerPipelineItem>[]
}

export function getPipelineColumns(): ColumnDef<CustomerPipelineItem>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Customer',
      cell: ({ row, table }) => {
        const meta = table.options.meta as PipelineTableMeta | undefined

        return (
          <div className="flex items-center justify-between gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 space-y-0.5 max-w-55">
                  <p className="font-medium leading-none truncate">{row.original.name}</p>
                  {row.original.email && (
                    <p className="text-xs text-muted-foreground truncate">{row.original.email}</p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {row.original.name}
              </TooltipContent>
            </Tooltip>
            {meta && (
              <EntityActionMenu
                entity={row.original}
                actions={meta.customerActions(row.original)}
                mode="compact"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
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
          {row.original.latestActivityAt
            ? formatDistanceToNow(new Date(row.original.latestActivityAt), { addSuffix: true })
            : '—'}
        </span>
      ),
    },
  ]
}
