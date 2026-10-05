import type { AnalyticsGroupBy, AnalyticsHygiene, AnalyticsInterval, AnalyticsPeriod, MeetingOrder } from '@/features/analytics/types'

export const MEETING_ORDER_LABELS: Record<MeetingOrder, string> = {
  first: 'First sit',
  repeat: 'Repeat',
  not_sat: 'Never sat',
  project: 'Project',
}

export const GROUP_BY_LABELS: Record<AnalyticsGroupBy, string> = {
  total: 'Total',
  leadSource: 'Source',
  month: 'Month',
  closer: 'Closer',
  outcome: 'Outcome',
  meetingOrder: 'Meeting order',
  city: 'City',
  zip: 'Zip',
}

export const INTERVAL_LABELS: Record<AnalyticsInterval, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
}

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-quarter': 'This quarter',
  'last-quarter': 'Last quarter',
  'ytd': 'Year to date',
  'last-12': 'Last 12 months',
  'custom': 'Custom',
}

export const HYGIENE_LABELS: Record<keyof AnalyticsHygiene, string> = {
  meetingsWithoutOutcome: 'Past meetings with no outcome',
  undatedSales: 'Sales with no approval date',
  newSalesWithoutProject: 'New sales without a project',
  unknownCityZip: 'Leads with unknown city or zip',
}
