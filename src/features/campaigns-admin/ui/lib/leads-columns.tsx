import type { ColumnDef } from '@tanstack/react-table'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { LeadRowActions } from '@/features/campaigns-admin/ui/components/leads/lead-row-actions'
import { LeadSelectCell } from '@/features/campaigns-admin/ui/components/leads/lead-select-cell'
import { LeadSelectHeader } from '@/features/campaigns-admin/ui/components/leads/lead-select-header'
import { LeadStatusBadge } from '@/features/campaigns-admin/ui/components/leads/lead-status-badge'
import { Button } from '@/shared/components/ui/button'

export interface LeadsTableMeta {
  onEnroll: (customerId: string) => void
  onOpenProfile: (customerId: string) => void
  pageRowIds: string[]
  selectedIds: Set<string>
  toggleSelect: (customerId: string) => void
  toggleSelectAll: (rowIds: string[], checked: boolean) => void
}

function formatEnrolledAt(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function buildLeadsColumns(): ColumnDef<CampaignLeadRow>[] {
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
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.campaignName ?? '—'}</span>
      ),
      header: 'Campaign',
      id: 'campaign',
    },
    {
      cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
      header: 'Status',
      id: 'status',
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
