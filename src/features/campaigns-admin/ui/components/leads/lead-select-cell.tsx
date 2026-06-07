'use client'

import type { Table } from '@tanstack/react-table'

import type { LeadsTableMeta, LeadTableRow } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { Checkbox } from '@/shared/components/ui/checkbox'

export function LeadSelectCell({ row, table }: { row: LeadTableRow, table: Table<LeadTableRow> }) {
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
