import type { AnalyticsUrlState, FilterKey } from '@/features/analytics/constants/query-parsers'

import { MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

/** A multi-select hands back plain strings; outcome and meeting-order keys keep only the values their parsers accept. */
export function filterUpdate(key: FilterKey, values: readonly string[]): Partial<AnalyticsUrlState> {
  switch (key) {
    case 'source':
      return { source: [...values] }
    case 'city':
      return { city: [...values] }
    case 'zip':
      return { zip: [...values] }
    case 'closer':
      return { closer: [...values] }
    case 'outcome':
      return { outcome: meetingOutcomes.filter(o => values.includes(o)) }
    case 'order':
      return { order: MEETING_ORDERS.filter(o => values.includes(o)) }
  }
}
