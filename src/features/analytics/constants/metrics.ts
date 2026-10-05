import type { AnalyticsCostKey } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

export type MetricFormat = 'count' | 'money' | 'rate' | 'multiple'

/** The not-applicable reason that silences a metric. */
export type MetricStage = 'leads' | 'sales' | 'cost'

export type MetricDefinition
  = | { label: string, /** For the phone's narrow headline cells. */ short?: string, format: MetricFormat, stage?: MetricStage, read: (row: AnalyticsReportRow) => number | null }
    | { label: string, notYet: string }

function cost(key: AnalyticsCostKey) {
  return (row: AnalyticsReportRow) => (row.cost.status === 'ok' ? row.cost.costs[key] : null)
}

// Every value is read from the report; nothing here computes a metric.
export const METRICS = {
  totalLeads: { label: 'Leads', format: 'count', stage: 'leads', read: r => r.totalLeads },
  mergedRecords: { label: 'Merged duplicates', format: 'count', stage: 'leads', read: r => r.mergedRecords },
  validLeads: { label: 'Valid leads', notYet: 'lead quality' },
  junkRate: { label: 'Junk rate', notYet: 'lead quality' },
  bookedLeads: { label: 'Booked leads', format: 'count', read: r => r.bookedLeads },
  bookingRate: { label: 'Booking rate', short: 'Booked', format: 'rate', stage: 'leads', read: r => r.rates.bookingRate },
  sits: { label: 'Sits', format: 'count', read: r => r.sits },
  sitRate: { label: 'Sit rate', short: 'Sat', format: 'rate', read: r => r.rates.sitRate },
  meetings: { label: 'Meetings', format: 'count', read: r => r.meetings },
  meetingsWithoutOutcome: { label: 'No outcome', format: 'count', read: r => r.hygiene.unresolvedMeetings },
  setter: { label: 'Setter', notYet: 'setter tracking' },
  newSales: { label: 'New sales', format: 'count', stage: 'sales', read: r => r.newSales },
  closeRate: { label: 'Close rate', short: 'Closed', format: 'rate', stage: 'sales', read: r => r.rates.closeRate },
  totalCloses: { label: 'Total closes', format: 'count', stage: 'sales', read: r => r.totalCloses },
  revenue: { label: 'Revenue', format: 'money', stage: 'sales', read: r => r.revenueCents },
  revenueNew: { label: 'New revenue', format: 'money', stage: 'sales', read: r => r.revenueNewCents },
  revenueUpsell: { label: 'Upsell revenue', format: 'money', stage: 'sales', read: r => r.revenueUpsellCents },
  averageTicket: { label: 'Average ticket', format: 'money', stage: 'sales', read: r => r.averageTicketCents },
  cancelled: { label: 'Cancelled', notYet: 'cancellations' },
  netSales: { label: 'Net sales', notYet: 'cancellations' },
  spend: { label: 'Spend', format: 'money', stage: 'cost', read: r => (r.cost.status === 'ok' ? r.cost.spendCents : null) },
  costPerLead: { label: 'Cost per lead', format: 'money', stage: 'cost', read: cost('costPerLead') },
  costPerBookedLead: { label: 'Cost per booked lead', format: 'money', stage: 'cost', read: cost('costPerBookedLead') },
  costPerSit: { label: 'Cost per sit', format: 'money', stage: 'cost', read: cost('costPerSit') },
  costPerNewSale: { label: 'Cost per sale', short: 'Per sale', format: 'money', stage: 'cost', read: cost('costPerNewSale') },
  returnOnSpend: { label: 'Revenue per $1', format: 'multiple', stage: 'cost', read: r => (r.cost.status === 'ok' ? r.cost.returnOnSpend : null) },
} as const satisfies Record<string, MetricDefinition>

export type MetricKey = keyof typeof METRICS
