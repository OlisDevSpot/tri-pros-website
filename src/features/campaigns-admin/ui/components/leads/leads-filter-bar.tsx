'use client'

import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'
import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

interface LeadsFilterBarProps {
  query: DataViewQueryResult<CampaignLeadRow, FieldList, string, 'page'>
}

export function LeadsFilterBar({ query }: LeadsFilterBarProps) {
  return (
    <QueryToolbar entityName="leads" query={query}>
      <QueryToolbar.Bar>
        <QueryToolbar.Search placeholder="Search name or phone…" />
        <QueryToolbar.FilterTrigger />
        <QueryToolbar.RefreshButton />
        <QueryToolbar.PageSize />
      </QueryToolbar.Bar>
      <QueryToolbar.ChipRail />
      <QueryToolbar.LiveStatus />
    </QueryToolbar>
  )
}
