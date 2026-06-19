import type { ColumnDef } from '@tanstack/react-table'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { formatDistanceToNow } from 'date-fns'

import { LeadCampaignCell } from '@/features/campaigns-admin/ui/components/leads/lead-campaign-cell'
import { LeadRowActions } from '@/features/campaigns-admin/ui/components/leads/lead-row-actions'
import { LeadSelectCell } from '@/features/campaigns-admin/ui/components/leads/lead-select-cell'
import { LeadSelectHeader } from '@/features/campaigns-admin/ui/components/leads/lead-select-header'
import { LeadStatusBadge } from '@/features/campaigns-admin/ui/components/leads/lead-status-badge'
import { Button } from '@/shared/components/ui/button'
import { formatPhone } from '@/shared/lib/phone'

export interface LeadsTableMeta {
  campaigns: VoipCampaign[]
  onEnroll: (customerId: string) => void
  onOpenProfile: (customerId: string) => void
  pageRowIds: string[]
  selectedIds: Set<string>
  toggleSelect: (customerId: string) => void
  toggleSelectAll: (rowIds: string[], checked: boolean) => void
}

/**
 * `DataTable` requires `TData extends { id: string }`. `CampaignLeadRow` uses
 * `customerId` as its primary key, so we alias it as `id` before passing rows
 * to the table. `customerId` is preserved for all column cell accessors.
 */
export type LeadTableRow = CampaignLeadRow & { id: string }

function formatEnrolledAt(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelativeAge(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function buildLeadsColumns(): ColumnDef<LeadTableRow>[] {
  return [
    {
      cell: ({ row, table }) => <LeadSelectCell row={row.original} table={table} />,
      enableSorting: false,
      header: ({ table }) => <LeadSelectHeader table={table} />,
      id: 'select',
      size: 36,
    },
    {
      accessorKey: 'name',
      cell: ({ row, table }) => {
        const meta = table.options.meta as LeadsTableMeta
        return (
          <button
            className="text-left font-medium text-foreground underline-offset-2 hover:underline"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              meta.onOpenProfile(row.original.customerId)
            }}
          >
            {row.original.name}
          </button>
        )
      },
      header: 'Name',
      id: 'name',
    },
    {
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.phone ? formatPhone(row.original.phone) : '—'}</span>,
      header: 'Phone',
      id: 'phone',
    },
    {
      cell: ({ row, table }) => {
        const meta = table.options.meta as LeadsTableMeta
        return <LeadCampaignCell campaigns={meta.campaigns} row={row.original} />
      },
      header: 'Campaign',
      id: 'campaign',
    },
    {
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.leadSourceName ?? '—'}</span>,
      header: 'Source',
      id: 'source',
    },
    {
      cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
      header: 'Status',
      id: 'status',
    },
    {
      cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{row.original.dialAttempts}</span>,
      header: 'Attempts',
      id: 'attempts',
    },
    {
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatRelativeAge(row.original.createdAt)}</span>,
      header: 'Age',
      id: 'createdAt',
    },
    {
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">{formatEnrolledAt(row.original.enrolledAt)}</span>
      ),
      header: 'Enrolled',
      id: 'enrolledAt',
    },
    {
      cell: ({ row, table }) => {
        const meta = table.options.meta as LeadsTableMeta
        if (row.original.status === 'eligible') {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                meta.onEnroll(row.original.customerId)
              }}
            >
              Enroll
            </Button>
          )
        }
        return (
          <LeadRowActions
            row={row.original}
            onEnroll={meta.onEnroll}
            onOpenProfile={meta.onOpenProfile}
          />
        )
      },
      enableSorting: false,
      header: '',
      id: 'actions',
    },
  ]
}
