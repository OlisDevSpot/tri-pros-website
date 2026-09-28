import type { AnalyticsHygiene } from '@/features/analytics/types'
import type { ProposalKind } from '@/shared/constants/enums/proposals'

import { ROOTS } from '@/shared/config/roots'
import { SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

/**
 * Each count opens its records table already filtered to the rows to fix;
 * unknown city/zip has no customers filter yet. `asOf` is the report's own
 * instant, so the link is identical on the server and in the browser.
 */
export function hygieneHref(key: keyof AnalyticsHygiene, asOf: string): string | null {
  switch (key) {
    case 'meetingsWithoutOutcome':
      return `${ROOTS.dashboard.meetings.root()}?${new URLSearchParams({ pm_outcome: 'not_set', pm_scheduledFor: JSON.stringify({ to: asOf }) })}`
    case 'undatedSales':
      return `${ROOTS.dashboard.proposals.root()}?${new URLSearchParams({ pp_status: SALE_STATUS, pp_missingApprovedAt: 'true' })}`
    case 'newSalesWithoutProject':
      return `${ROOTS.dashboard.proposals.root()}?${new URLSearchParams({ pp_kind: 'initial-sale' satisfies ProposalKind, pp_status: SALE_STATUS, pp_noProject: 'true' })}`
    case 'unknownCityZip':
      return null
  }
}
