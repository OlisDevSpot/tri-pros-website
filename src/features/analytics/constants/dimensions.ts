export const MEETING_ORDERS = ['first', 'repeat', 'not_sat', 'project'] as const
export type MeetingOrder = (typeof MEETING_ORDERS)[number]

export const ANALYTICS_GROUP_BYS = ['total', 'leadSource', 'month', 'closer', 'outcome', 'meetingOrder', 'city', 'zip'] as const
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUP_BYS)[number]

export const ANALYTICS_PERIODS = ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'ytd', 'last-12', 'custom'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]
