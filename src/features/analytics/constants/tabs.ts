import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { AnalyticsGroupBy, AnalyticsHygiene } from '@/features/analytics/types'

export const REPORT_TAB_KEYS = ['overview', 'leads', 'appointments', 'sales'] as const
export type ReportTab = (typeof REPORT_TAB_KEYS)[number]

export const ANALYTICS_TABS = [...REPORT_TAB_KEYS, 'projects', 'spend'] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: 'Overview',
  leads: 'Leads',
  appointments: 'Appointments',
  sales: 'Sales',
  projects: 'Projects',
  spend: 'Spend',
}

export interface HeadlineFigure {
  metric: MetricKey
  /** A rate or cost shown under the figure. */
  sub?: MetricKey
}

export interface ReportTabConfig {
  figures: readonly HeadlineFigure[]
  /** The breakdown's columns when they differ from the headline's figures. */
  columns?: readonly MetricKey[]
  defaultFocus: MetricKey
  /** The first is the default. */
  groupBys: readonly Exclude<AnalyticsGroupBy, 'total'>[]
  hygiene: readonly (keyof AnalyticsHygiene)[]
}

export const REPORT_TABS: Record<ReportTab, ReportTabConfig> = {
  overview: {
    figures: [
      { metric: 'totalLeads' },
      { metric: 'bookedLeads', sub: 'bookingRate' },
      { metric: 'sits', sub: 'sitRate' },
      { metric: 'newSales', sub: 'closeRate' },
      { metric: 'revenue' },
      { metric: 'spend', sub: 'costPerNewSale' },
    ],
    // The strip stays short; the per-source table carries cost at every stage.
    columns: ['totalLeads', 'bookedLeads', 'bookingRate', 'sits', 'sitRate', 'newSales', 'closeRate', 'revenue', 'spend', 'costPerLead', 'costPerBookedLead', 'costPerSit', 'costPerNewSale', 'returnOnSpend'],
    defaultFocus: 'sits',
    groupBys: ['leadSource', 'month', 'closer', 'city', 'zip'],
    hygiene: ['meetingsWithoutOutcome', 'undatedSales', 'newSalesWithoutProject', 'unknownCityZip'],
  },
  leads: {
    figures: [{ metric: 'totalLeads' }, { metric: 'mergedRecords' }, { metric: 'costPerLead' }, { metric: 'validLeads' }, { metric: 'junkRate' }],
    defaultFocus: 'totalLeads',
    groupBys: ['leadSource', 'city', 'zip', 'month'],
    hygiene: ['unknownCityZip'],
  },
  appointments: {
    figures: [{ metric: 'bookedLeads', sub: 'bookingRate' }, { metric: 'sits', sub: 'sitRate' }, { metric: 'meetings' }, { metric: 'meetingsWithoutOutcome' }, { metric: 'setter' }],
    defaultFocus: 'sits',
    groupBys: ['closer', 'outcome', 'meetingOrder', 'leadSource'],
    hygiene: ['meetingsWithoutOutcome'],
  },
  sales: {
    figures: [{ metric: 'newSales', sub: 'closeRate' }, { metric: 'totalCloses' }, { metric: 'revenueNew' }, { metric: 'revenueUpsell' }, { metric: 'averageTicket' }, { metric: 'cancelled' }, { metric: 'netSales' }],
    defaultFocus: 'newSales',
    groupBys: ['closer', 'leadSource', 'month'],
    hygiene: ['undatedSales', 'newSalesWithoutProject'],
  },
}

export function isReportTab(tab: AnalyticsTab): tab is ReportTab {
  return tab in REPORT_TABS
}
