import type { FilterKey } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import type { FilterDefinition } from '@/shared/dal/client/lib/types'

import { MEETING_ORDERS, UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/dimensions'
import { MEETING_ORDER_LABELS } from '@/features/analytics/constants/labels'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

export interface FilterField {
  key: FilterKey
  definition: Extract<FilterDefinition, { type: 'multi-select' }>
}

/** One multi-select per filter key, shaped for the shared `MultiSelectFilterControl`; "unknown" is always a choice for place and source. */
export function buildFilterFields(options: AnalyticsFilterOptions | undefined, closers: readonly { id: string, name: string }[]): FilterField[] {
  const field = (key: FilterKey, label: string, choices: { value: string, label: string }[]): FilterField => ({ key, definition: { id: key, type: 'multi-select', label, options: choices } })
  return [
    field('source', 'Lead source', [
      ...(options?.leadSources ?? []).map(s => ({ value: s.id, label: s.archived ? `${s.name} (archived)` : s.name })),
      { value: UNKNOWN_FILTER_VALUE, label: 'Unknown source' },
    ]),
    field('city', 'City', [...(options?.cities ?? []).map(c => ({ value: c, label: c })), { value: UNKNOWN_FILTER_VALUE, label: 'Unknown city' }]),
    field('zip', 'Zip', [...(options?.zips ?? []).map(z => ({ value: z, label: z })), { value: UNKNOWN_FILTER_VALUE, label: 'Unknown zip' }]),
    field('closer', 'Closer', closers.map(u => ({ value: u.id, label: u.name }))),
    field('outcome', 'Meeting outcome', meetingOutcomes.map(o => ({ value: o, label: MEETING_OUTCOME_LABELS[o] }))),
    field('order', 'Meeting order', MEETING_ORDERS.map(o => ({ value: o, label: MEETING_ORDER_LABELS[o] }))),
  ]
}
