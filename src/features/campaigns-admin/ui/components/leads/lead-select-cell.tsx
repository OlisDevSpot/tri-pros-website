'use client'

import type { Table } from '@tanstack/react-table'

import type { LeadsTableMeta } from '@/features/campaigns-admin/ui/lib/leads-columns'
import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { Checkbox } from '@/shared/components/ui/checkbox'

export function LeadSelectCell({ row, table }: { row: CampaignLeadRow, table: Table<CampaignLeadRow> }) {
  const meta = table.options.meta as LeadsTableMeta
  return (
    <Checkbox
      aria-label={`Select ${row.name}`}
      checked={meta.selectedIds.has(row.customerId)}
      onCheckedChange={() => meta.toggleSelect(row.customerId)}
      onClick={e => e.stopPropagation()}
    />
  )
}
