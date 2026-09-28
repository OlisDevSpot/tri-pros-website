import type { ResolvedPeriod } from '@/features/analytics/lib/analytics-periods'
import type { DayRange, SpendSource } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsCounts, AnalyticsFacts, AnalyticsReport, AnalyticsReportRow, RowCost } from '@/features/analytics/types'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
import { addMonths, lastDayOfMonth, monthsBetween, resolveAnalyticsPeriod } from '@/features/analytics/lib/analytics-periods'
import { computeCosts, findMissingSpend, notApplicableReasons, sourceRowCostReason, spendInRange, totalRevenueCents } from '@/features/analytics/lib/analytics-rules'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { businessDayKey, businessMonthWindow } from '@/shared/lib/business-time'

export interface AnalyticsReportData {
  facts: AnalyticsFacts
  sources: SpendSource[]
  spend: LeadSourceSpendEntry[]
}

const TREND_MONTHS = 12

/** The months a report reads spend for: the trend's twelve plus every month the period touches (a custom period can reach further back). */
export function analyticsReportWindow(input: Pick<AnalyticsReportInput, 'period' | 'from' | 'to'>, now: Date): { period: ResolvedPeriod, trendMonths: string[], spendMonths: string[] } {
  const period = resolveAnalyticsPeriod(input, now)
  const lastMonth = period.lastDay.slice(0, 7)
  const trendMonths = monthsBetween(addMonths(lastMonth, 1 - TREND_MONTHS), lastMonth)
  const periodMonths = monthsBetween(period.firstDay.slice(0, 7), lastMonth)
  return { period, trendMonths, spendMonths: [...new Set([...periodMonths, ...trendMonths])].sort() }
}

function monthDays(month: string): DayRange {
  return { first: `${month}-01`, last: lastDayOfMonth(month) }
}

function intersectDays(a: DayRange, b: DayRange): DayRange {
  return { first: a.first > b.first ? a.first : b.first, last: a.last < b.last ? a.last : b.last }
}

export function buildAnalyticsReport(data: AnalyticsReportData, input: AnalyticsReportInput, now: Date): AnalyticsReport {
  const { period, trendMonths, spendMonths } = analyticsReportWindow(input, now)
  const today = businessDayKey(now)
  const records = buildLeadRecords(data.facts, now)
  const leads = records.leads.map(p => ({ leadSourceId: p.leadSourceId, leadAt: p.leadAt }))
  const periodDays: DayRange = { first: period.firstDay, last: period.lastDay }
  const allowed = input.filters.leadSourceIds?.length ? new Set(input.filters.leadSourceIds) : null
  const scopedSources = data.sources.filter(s => !allowed || allowed.has(s.id))

  const rowCost = (counts: AnalyticsCounts, revenueCents: number | null, sources: SpendSource[], days: DayRange, reason: string | undefined): RowCost => {
    if (reason) {
      return { status: 'not_applicable', reason }
    }
    const missing = findMissingSpend(sources, data.spend, leads, days)
    if (missing.length > 0) {
      return { status: 'missing', missing }
    }
    const spendCents = spendInRange(sources, data.spend, days, today)
    return { status: 'ok', spendCents, ...computeCosts(spendCents, counts, revenueCents) }
  }
  const withCost = (counts: AnalyticsCounts, sources: SpendSource[], days: DayRange, reason: string | undefined): AnalyticsReportRow => {
    const revenueCents = totalRevenueCents(counts)
    return { ...counts, revenueCents, cost: rowCost(counts, revenueCents, sources, days, reason) }
  }

  const headlineReasons = notApplicableReasons(input.filters, 'total')
  const headlineResult = aggregateLeadRecords(records, { ...input.filters, range: period.range }, 'total')
  const headline = withCost(headlineResult.rows[0], scopedSources, periodDays, headlineReasons.cost)

  const breakdownReasons = notApplicableReasons(input.filters, input.groupBy)
  const breakdown = aggregateLeadRecords(records, { ...input.filters, range: period.range }, input.groupBy).rows.map((row) => {
    if (input.groupBy === 'leadSource') {
      const reason = breakdownReasons.cost ?? sourceRowCostReason(row.groupKey)
      return withCost(row, scopedSources.filter(s => s.id === row.groupKey), periodDays, reason)
    }
    if (input.groupBy === 'month' && row.groupKey !== null) {
      return withCost(row, scopedSources, intersectDays(periodDays, monthDays(row.groupKey)), breakdownReasons.cost)
    }
    return withCost(row, scopedSources, periodDays, breakdownReasons.cost)
  })

  const firstMonth = period.firstDay.slice(0, 7)
  const lastMonth = period.lastDay.slice(0, 7)
  const trend = trendMonths.map((month) => {
    const row = aggregateLeadRecords(records, { ...input.filters, range: businessMonthWindow(month) }, 'total').rows[0]
    return { month, selected: month >= firstMonth && month <= lastMonth, row: withCost(row, scopedSources, monthDays(month), headlineReasons.cost) }
  })

  // Data entry is owed for every source, whatever the filters narrow to, over every month the page shows.
  const spendMissing = findMissingSpend(data.sources, data.spend, leads, { first: `${spendMonths[0]}-01`, last: lastDayOfMonth(spendMonths[spendMonths.length - 1]) })
  // A month owed outside the trend (a long custom period) still needs a cell, or its warning could never be cleared.
  const spendGridMonths = [...new Set([...trendMonths, ...spendMissing.map(m => m.month)])].sort()

  // Hygiene counts every record so each count matches the records table it links to.
  const everything = aggregateLeadRecords(records, {}, 'total')
  const all = everything.rows[0]

  return {
    generatedAt: now.toISOString(),
    firstDay: period.firstDay,
    lastDay: period.lastDay,
    groupBy: input.groupBy,
    headline,
    breakdown,
    trend,
    notApplicable: { headline: headlineReasons, breakdown: breakdownReasons },
    spendMissing,
    spendGridMonths,
    undatedSales: headlineResult.undatedSales,
    orphans: records.orphans,
    hygiene: {
      meetingsWithoutOutcome: all.hygiene.unresolvedMeetings,
      undatedSales: everything.undatedSales ?? 0,
      newSalesWithoutProject: all.hygiene.newSalesWithoutProject ?? 0,
      unknownCityZip: all.hygiene.unknownCityZip ?? 0,
    },
  }
}
