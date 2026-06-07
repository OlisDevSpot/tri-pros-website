'use client'

import type { PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

interface LeadsFilterBarProps {
  pagination: PaginatedQueryResult<CampaignLeadRow>
}

export function LeadsFilterBar({ pagination }: LeadsFilterBarProps) {
  return (
    <QueryToolbar entityName="leads" pagination={pagination}>
      <QueryToolbar.Bar>
        <QueryToolbar.Search placeholder="Search name or phone…" />
        <QueryToolbar.FilterTrigger />
        <QueryToolbar.PageSize />
      </QueryToolbar.Bar>
      <QueryToolbar.ChipRail />
      <QueryToolbar.LiveStatus />
    </QueryToolbar>
  )
}
