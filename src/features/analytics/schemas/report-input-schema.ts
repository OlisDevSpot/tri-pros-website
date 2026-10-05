import type { AnalyticsFilters } from '@/features/analytics/types'

import z from 'zod'

import { ANALYTICS_GROUP_BYS, ANALYTICS_INTERVALS, ANALYTICS_PERIODS, MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

// A day that round-trips through Date exists; '2026-02-30' rolls over and '2026-13-45' is an invalid Date.
export const businessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const date = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day)
}, 'Not a calendar day.')

// Ties the wire shape to the aggregator's filters: a field added to one and not the other fails tsc.
export const analyticsFiltersSchema = z.object({
  leadSourceIds: z.array(z.string().uuid().nullable()).optional(),
  cities: z.array(z.string().nullable()).optional(),
  zips: z.array(z.string().nullable()).optional(),
  closerIds: z.array(z.string()).optional(),
  outcomes: z.array(z.enum(meetingOutcomes)).optional(),
  meetingOrder: z.array(z.enum(MEETING_ORDERS)).optional(),
}) satisfies z.ZodType<Omit<AnalyticsFilters, 'range'>>

export const analyticsReportInputSchema = z.object({
  period: z.enum(ANALYTICS_PERIODS),
  from: businessDaySchema.optional(),
  to: businessDaySchema.optional(),
  filters: analyticsFiltersSchema,
  groupBy: z.enum(ANALYTICS_GROUP_BYS),
  /** The chart's step; the report falls back to the period's default when it does not fit. */
  interval: z.enum(ANALYTICS_INTERVALS).optional(),
}).refine(
  input => input.period !== 'custom' || (!!input.from && !!input.to && input.from <= input.to),
  'A custom period needs a first and a last day, in order.',
)

export type AnalyticsReportInput = z.infer<typeof analyticsReportInputSchema>
