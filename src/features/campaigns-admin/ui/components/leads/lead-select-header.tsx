'use client'

import type { Table } from '@tanstack/react-table'

import type { LeadsTableMeta } from '@/features/campaigns-admin/ui/lib/leads-columns'
import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { Checkbox } from '@/shared/components/ui/checkbox'

export function LeadSelectHeader({ table }: { table: Table<CampaignLeadRow> }) {
  const meta = table.options.meta as LeadsTableMeta
  const ids = meta.pageRowIds
  const allSelected = ids.length > 0 && ids.every(id => meta.selectedIds.has(id))
  return (
    <Checkbox
      aria-label="Select all on this page"
      checked={allSelected}
      onCheckedChange={checked => meta.toggleSelectAll(ids, checked === true)}
    />
  )
}
