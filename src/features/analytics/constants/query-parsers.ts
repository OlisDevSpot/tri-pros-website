import type { inferParserType } from 'nuqs/server'

import { createLoader, parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { ANALYTICS_GROUP_BYS, ANALYTICS_INTERVALS, ANALYTICS_PERIODS, MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { ANALYTICS_TABS } from '@/features/analytics/constants/tabs'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

// The whole page state lives in the URL so every view can be bookmarked.
export const analyticsSearchParams = {
  period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault('this-month'),
  from: parseAsString.withDefault(''),
  to: parseAsString.withDefault(''),
  source: parseAsArrayOf(parseAsString).withDefault([]),
  city: parseAsArrayOf(parseAsString).withDefault([]),
  zip: parseAsArrayOf(parseAsString).withDefault([]),
  closer: parseAsArrayOf(parseAsString).withDefault([]),
  outcome: parseAsArrayOf(parseAsStringLiteral(meetingOutcomes)).withDefault([]),
  order: parseAsArrayOf(parseAsStringLiteral(MEETING_ORDERS)).withDefault([]),
  tab: parseAsStringLiteral(ANALYTICS_TABS).withDefault('overview'),
  groupBy: parseAsStringLiteral(ANALYTICS_GROUP_BYS),
  focus: parseAsString,
  series: parseAsArrayOf(parseAsString),
  interval: parseAsStringLiteral(ANALYTICS_INTERVALS),
}

export type AnalyticsUrlState = inferParserType<typeof analyticsSearchParams>

export const loadAnalyticsSearchParams = createLoader(analyticsSearchParams)

export const FILTER_KEYS = ['source', 'city', 'zip', 'closer', 'outcome', 'order'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export const CLEARED_FILTERS = { source: null, city: null, zip: null, closer: null, outcome: null, order: null } as const satisfies Record<FilterKey, null>
