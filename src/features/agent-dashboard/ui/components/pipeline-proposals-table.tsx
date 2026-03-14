'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { ProposalPipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { format, formatDistanceToNow } from 'date-fns'
import { ArrowUpDownIcon, ExternalLinkIcon } from 'lucide-react'

import { PROPOSAL_STATUS_COLORS } from '@/features/proposal-flow/constants/status-colors'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const STAGE_TO_STATUS: Record<string, string> = {
  proposal_draft: 'draft',
  proposal_sent: 'sent',
  contract_signed: 'approved',
  declined: 'declined',
}

interface ProposalTableMeta {
  onUpdateCreatedAt: (proposalId: string, date: Date) => void
}

function DateTimeCell({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  const d = new Date(dateStr)
  const relative = formatDistanceToNow(d, { addSuffix: true })
  const time = format(d, 'h:mm a')

  return (
    <div className="max-w-37.5 tabular-nums">
      <p className="text-sm font-medium leading-tight">{relative}</p>
      <p className="text-xs text-muted-foreground">{time}</p>
    </div>
  )
}

function getColumns(): ColumnDef<ProposalPipelineItem>[] {
  return [
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
            {row.original.trade && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.original.trade}</p>
            )}
          </div>
          <Button asChild size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={`/dashboard?step=edit-proposal&proposalId=${row.original.id}`}>
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span className="sr-only">Open</span>
            </a>
          </Button>
        </div>
      ),
    },
    {
      accessorKey: 'stage',
      header: 'Status',
      cell: ({ row }) => {
        const status = STAGE_TO_STATUS[row.original.stage] ?? row.original.stage
        const colorKey = status as keyof typeof PROPOSAL_STATUS_COLORS
        return (
          <Badge className={cn('capitalize text-xs', PROPOSAL_STATUS_COLORS[colorKey])}>
            {status}
          </Badge>
        )
      },
    },
    {
      id: 'value',
      accessorFn: row => row.value,
      header: 'Value',
      cell: ({ row }) => {
        const val = row.original.value
        if (val == null) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        return (
          <span className="text-sm font-medium tabular-nums">
            $
            {val.toLocaleString()}
          </span>
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
      cell: ({ row, table }) => {
        const meta = table.options.meta as (ProposalTableMeta & { activeRowId: string | null }) | undefined

        return (
          <div className="max-w-37.5" onClick={e => e.stopPropagation()}>
            <DateTimePicker
              value={new Date(row.original.createdAt)}
              onChange={(date) => {
                if (date) {
                  meta?.onUpdateCreatedAt(row.original.id, date)
                }
              }}
            />
          </div>
        )
      },
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'sentAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Sent
          <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ),
      cell: ({ row }) => <DateTimeCell dateStr={row.original.sentAt} />,
      sortingFn: 'datetime',
    },
  ]
}

interface Props {
  data: ProposalPipelineItem[]
  onUpdateCreatedAt: (proposalId: string, date: Date) => void
}

export function PipelineProposalsTable({ data, onUpdateCreatedAt }: Props) {
  return (
    <DataTable
      data={data}
      columns={getColumns()}
      meta={{ onUpdateCreatedAt }}
      defaultSort={[{ id: 'createdAt', desc: true }]}
      entityName="proposal"
      pageSize={12}
    />
  )
}
