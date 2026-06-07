import type { FilterDefinition } from '@/shared/dal/client/lib/types'

import { LEAD_STATUS_OPTIONS } from '@/features/campaigns-admin/constants/lead-status'

interface BuildArgs {
  campaigns: { label: string, value: string }[]
  sources: { label: string, value: string }[]
}

export function buildLeadsFilterConfig({ campaigns, sources }: BuildArgs): FilterDefinition[] {
  return [
    { id: 'status', label: 'Status', options: LEAD_STATUS_OPTIONS, type: 'select' },
    { id: 'sourceSlug', label: 'Source', options: sources, type: 'select' },
    { id: 'campaignId', label: 'Campaign', options: campaigns, type: 'select' },
  ]
}
