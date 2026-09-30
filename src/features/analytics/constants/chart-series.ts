import type { MetricKey } from '@/features/analytics/constants/metrics'

interface SeriesColor {
  fill: string
  swatch: string
}

const LEADS = { fill: 'var(--series-leads)', swatch: 'bg-(--series-leads)' }
const BOOKED = { fill: 'var(--series-booked)', swatch: 'bg-(--series-booked)' }
const SITS = { fill: 'var(--series-sits)', swatch: 'bg-(--series-sits)' }
const SALES = { fill: 'var(--series-sales)', swatch: 'bg-(--series-sales)' }
const STRONG = { fill: 'var(--series-neutral-strong)', swatch: 'bg-(--series-neutral-strong)' }
const SOFT = { fill: 'var(--series-neutral-soft)', swatch: 'bg-(--series-neutral-soft)' }

/**
 * Each metric keeps one color wherever it is charted, so toggling series never repaints the rest.
 * The four lead-chain stages are one cyan → navy ramp (ordinal: a later stage carries more ink), validated
 * light and dark with the dataviz palette checks; every other measure sits on neutral slate.
 */
export const SERIES_COLORS = {
  totalLeads: LEADS,
  bookedLeads: BOOKED,
  sits: SITS,
  newSales: SALES,
  totalCloses: STRONG,
  meetings: SOFT,
  meetingsWithoutOutcome: STRONG,
  mergedRecords: SOFT,
  revenue: STRONG,
  revenueNew: STRONG,
  revenueUpsell: SOFT,
  spend: SOFT,
} as const satisfies Partial<Record<MetricKey, SeriesColor>>

export type ChartSeriesKey = keyof typeof SERIES_COLORS

/** Shared by the fixed axis and the scrolling plot so their scales line up to the pixel. */
export const CHART_MARGIN = { top: 6, right: 0, bottom: 0, left: 0 }
export const CHART_X_AXIS_HEIGHT = 24
