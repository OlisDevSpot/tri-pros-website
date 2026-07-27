import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { LEAD_STATUS_OPTIONS } from '@/features/campaigns-admin/constants/lead-status'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'

/**
 * Static, serializable slice of the campaigns-leads table config — the ids
 * and types `buildLeadsFilterConfig` produces. This is what
 * `usePaginatedQuery` derives its URL parsers from; it must stay identical
 * across renders regardless of whether `getSourceCampaignSummaries` /
 * `listCampaigns` have resolved yet.
 *
 * `status` options are `LEAD_STATUS_OPTIONS` — the same hardcoded constant
 * `buildLeadsFilterConfig` uses, not runtime-derived, so it's safe (and
 * stricter) to populate here for real. `sourceSlug` and `campaignId` are
 * runtime-populated from the two supporting queries, so they get
 * `options: [] as const` — per `derive-paginated-query-state.ts:60`, empty
 * options fall back to free-string parsing, which stays stable forever
 * instead of flipping to `parseAsStringLiteral` mid-session once the
 * queries resolve.
 *
 * The runtime-merged config (same ids/types, `sourceSlug`/`campaignId`
 * options populated from the two supporting queries) is built separately by
 * `buildLeadsFilterConfig` and feeds ONLY the filter toolbar UI — never this
 * hook input. See `campaigns-leads-view.tsx`.
 *
 * Deliberately NO `paramPrefix` — the live table has none today; adding one
 * would rename every URL param, which is a behavior change out of scope
 * here.
 */
export const CAMPAIGN_LEADS_TABLE_QUERY_CONFIG = {
  pageSize: 25,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: [
    { id: 'status', label: 'Status', options: LEAD_STATUS_OPTIONS, type: 'select' },
    { id: 'sourceSlug', label: 'Source', options: [] as const, type: 'select' },
    { id: 'campaignId', label: 'Campaign', options: [] as const, type: 'select' },
  ],
} as const satisfies PaginatedQueryConfig
