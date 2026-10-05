export const MEETING_ORDERS = ['first', 'repeat', 'not_sat', 'project'] as const
export type MeetingOrder = (typeof MEETING_ORDERS)[number]

export const ANALYTICS_GROUP_BYS = ['total', 'leadSource', 'month', 'closer', 'outcome', 'meetingOrder', 'city', 'zip'] as const
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUP_BYS)[number]

export const ANALYTICS_PERIODS = ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'ytd', 'last-12', 'custom'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

// Stands for "no value" (unknown source, city or zip). Source ids are uuids and
// intake's "Unknown" placeholder is already folded to null, so nothing collides.
export const UNKNOWN_FILTER_VALUE = 'unknown'

/** The chart's time step. Which ones a period offers is decided in `lib/chart-buckets.ts`. */
export const ANALYTICS_INTERVALS = ['day', 'week', 'month'] as const
export type AnalyticsInterval = (typeof ANALYTICS_INTERVALS)[number]
