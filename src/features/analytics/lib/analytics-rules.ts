import type { AnalyticsCounts, AnalyticsFilters, AnalyticsGroupBy, BookedLead, LeadAnchor, MeetingOrder } from '@/features/analytics/types'
import type { LeadSourceSpendMode } from '@/shared/constants/enums/lead-sources'
import type { MeetingSit } from '@/shared/constants/enums/meetings'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

import { lastDayOfMonth } from '@/features/analytics/lib/analytics-periods'
import { compareRecordAge } from '@/shared/entities/customers/lib/group-duplicate-people'
import { businessDayKey } from '@/shared/lib/business-time'

/** Website intake writes these placeholders when a lead gives no address. */
export const UNKNOWN_PLACE_VALUES: readonly string[] = ['Unknown', '']

export function toKnownPlace(value: string): string | null {
  const trimmed = value.trim()
  return UNKNOWN_PLACE_VALUES.includes(trimmed) ? null : trimmed
}

/** A lead is credited to the person's first contact with us; a later duplicate record never re-credits it. */
export function pickLeadAnchor(records: readonly CustomerFact[]): LeadAnchor {
  const earliest = [...records].sort(compareRecordAge)[0]
  return {
    leadAt: earliest.createdAt,
    leadSourceId: earliest.leadSourceId,
    city: toKnownPlace(earliest.city),
    zip: toKnownPlace(earliest.zip),
  }
}

/** Every extra record a person has is a duplicate folded into one lead; the count shows how much record cleanup is due. */
export function mergedRecordCount(person: { customerIds: readonly string[] }): number {
  return person.customerIds.length - 1
}

/**
 * `first` is the first real sit: a cancelled or no-show meeting before it (a
 * reschedule's original) is noise, not the first visit. Expects oldest first.
 */
export function deriveMeetingOrder(chronological: readonly { project: boolean, sit: MeetingSit }[]): MeetingOrder[] {
  const firstSitIndex = chronological.findIndex(m => !m.project && m.sit === 'sat')
  return chronological.map((m, index) => {
    if (m.project) {
      return 'project'
    }
    if (index === firstSitIndex) {
      return 'first'
    }
    return firstSitIndex !== -1 && index > firstSitIndex ? 'repeat' : 'not_sat'
  })
}

/**
 * A customer is booked once, however many times they reschedule; the booking
 * lands on the sit when there was one, so sits can never exceed booked leads.
 * Expects oldest first.
 */
export function pickBookedLead(chronological: readonly { id: string, at: string, project: boolean, sit: MeetingSit }[]): BookedLead | null {
  const leadMeetings = chronological.filter(m => !m.project)
  const firstSit = leadMeetings.find(m => m.sit === 'sat')
  const picked = firstSit ?? leadMeetings[0]
  return picked ? { at: picked.at, meetingId: picked.id, sat: picked === firstSit } : null
}

/** A past meeting nobody has given an outcome yet is unknown, not a no-show — surfaced so it gets fixed. */
export function isUnresolvedMeeting(meeting: { sit: MeetingSit, at: string }, now: Date): boolean {
  return meeting.sit === 'unknown' && Date.parse(meeting.at) < now.getTime()
}

export type AnalyticsStage = 'leads' | 'sales'

/**
 * A lead has no closer, outcome or meeting order, and a sale has no outcome or
 * meeting order, so filtering or grouping by those makes the stage not applicable —
 * shown as such, never as an unfiltered number.
 */
export function inapplicableStages(filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): AnalyticsStage[] {
  const byMeeting = !!(filters.outcomes?.length || filters.meetingOrder?.length) || groupBy === 'outcome' || groupBy === 'meetingOrder'
  const byCloser = !!filters.closerIds?.length || groupBy === 'closer'
  const stages: AnalyticsStage[] = []
  if (byMeeting || byCloser) {
    stages.push('leads')
  }
  if (byMeeting) {
    stages.push('sales')
  }
  return stages
}

/**
 * Stage-to-stage rates over the same period. Close rate uses new sales only:
 * an upsell never came through a new-lead sit.
 */
export const ANALYTICS_RATES = {
  bookingRate: { numerator: 'bookedLeads', denominator: 'validLeads' },
  sitRate: { numerator: 'sits', denominator: 'bookedLeads' },
  closeRate: { numerator: 'newSales', denominator: 'sits' },
} as const

export type AnalyticsRateKey = keyof typeof ANALYTICS_RATES

/** A rate over nothing is unknown, not 0% — an empty month must not read as a failure. */
export function computeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null
  }
  return numerator / denominator
}

export interface SpendSource {
  id: string
  spendMode: LeadSourceSpendMode
}

/** Business days, both inclusive. */
export interface DayRange {
  first: string
  last: string
}

export interface MissingSpend {
  leadSourceId: string
  month: string
}

function dayCount(first: string, last: string): number {
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1
}

function manualSourceIds(sources: readonly SpendSource[]): Set<string> {
  return new Set(sources.filter(s => s.spendMode === 'manual').map(s => s.id))
}

/**
 * Spend accrues evenly across its month, so a period covering part of a month
 * carries that share by days, and days after today carry none yet. Free
 * sources cost nothing. Only the given sources count: the caller scopes by source.
 */
export function spendInRange(sources: readonly SpendSource[], entries: readonly LeadSourceSpendEntry[], days: DayRange, today: string): number {
  const manual = manualSourceIds(sources)
  const last = days.last < today ? days.last : today
  let total = 0
  for (const entry of entries) {
    if (!manual.has(entry.leadSourceId)) {
      continue
    }
    const monthFirst = `${entry.month}-01`
    const monthLast = lastDayOfMonth(entry.month)
    const first = days.first > monthFirst ? days.first : monthFirst
    const end = last < monthLast ? last : monthLast
    if (first > end) {
      continue
    }
    total += entry.amountCents * dayCount(first, end) / dayCount(monthFirst, monthLast)
  }
  return Math.round(total)
}

/**
 * A manual source that brought a lead in a month with no spend entered for
 * that month makes every cost over it unknown: a blank is "not entered", never $0.
 */
export function findMissingSpend(
  sources: readonly SpendSource[],
  entries: readonly LeadSourceSpendEntry[],
  leads: readonly { leadSourceId: string | null, leadAt: string }[],
  days: DayRange,
): MissingSpend[] {
  const manual = manualSourceIds(sources)
  const entered = new Set(entries.map(e => `${e.leadSourceId}|${e.month}`))
  const missing = new Map<string, MissingSpend>()
  for (const lead of leads) {
    if (lead.leadSourceId === null || !manual.has(lead.leadSourceId)) {
      continue
    }
    const day = businessDayKey(new Date(lead.leadAt))
    if (day < days.first || day > days.last) {
      continue
    }
    const key = `${lead.leadSourceId}|${day.slice(0, 7)}`
    if (!entered.has(key)) {
      missing.set(key, { leadSourceId: lead.leadSourceId, month: day.slice(0, 7) })
    }
  }
  return [...missing.values()].sort((a, b) => a.month.localeCompare(b.month) || a.leadSourceId.localeCompare(b.leadSourceId))
}

/** Cost per stage divides spend by that stage's count, so each stage shows what one more of it costs. */
export const ANALYTICS_COSTS = {
  costPerLead: 'totalLeads',
  costPerBookedLead: 'bookedLeads',
  costPerSit: 'sits',
  costPerNewSale: 'newSales',
} as const

export type AnalyticsCostKey = keyof typeof ANALYTICS_COSTS

/** Revenue counts upsells as well as new sales; when the sales stage is not applicable it stays unknown. */
export function totalRevenueCents(counts: Pick<AnalyticsCounts, 'revenueNewCents' | 'revenueUpsellCents'>): number | null {
  if (counts.revenueNewCents === null || counts.revenueUpsellCents === null) {
    return null
  }
  return counts.revenueNewCents + counts.revenueUpsellCents
}

/**
 * A cost over zero of anything is unknown, not free or infinite; revenue ÷ spend says what each dollar brought back.
 * Each key is written out so adding one to `ANALYTICS_COSTS` fails here until it is computed.
 */
export function computeCosts(
  spendCents: number,
  counts: Pick<AnalyticsCounts, (typeof ANALYTICS_COSTS)[AnalyticsCostKey]>,
  revenueCents: number | null,
): { costs: Record<AnalyticsCostKey, number | null>, returnOnSpend: number | null } {
  return {
    costs: {
      costPerLead: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerLead]),
      costPerBookedLead: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerBookedLead]),
      costPerSit: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerSit]),
      costPerNewSale: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerNewSale]),
    },
    returnOnSpend: computeRate(revenueCents, spendCents),
  }
}

export type NotApplicableReasons = Partial<Record<AnalyticsStage | 'cost', string>>

const COST_GROUPINGS: readonly AnalyticsGroupBy[] = ['total', 'leadSource', 'month']

const UNKNOWN_SOURCE_COST_REASON = 'A lead with no source has no spend, so its cost is unknown.'

/** A source breakdown's unknown-source row has leads but no spend to divide. */
export function sourceRowCostReason(leadSourceId: string | null): string | undefined {
  return leadSourceId === null ? UNKNOWN_SOURCE_COST_REASON : undefined
}

/**
 * Spend is entered per source and month, so cost exists only for a total,
 * source or month view narrowed by nothing but source; anything else would
 * divide one slice's count by the whole spend. Unknown-source leads carry no
 * spend, so including them would show $0 or dilute cost per lead.
 */
export function notApplicableReasons(filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): NotApplicableReasons {
  const reasons: NotApplicableReasons = {}
  const stages = inapplicableStages(filters, groupBy)
  if (stages.includes('leads')) {
    reasons.leads = 'A lead has no closer, outcome or meeting order until a meeting is booked.'
  }
  if (stages.includes('sales')) {
    reasons.sales = 'A sale is not tied to one meeting outcome or meeting order.'
  }
  const narrowed = !!(filters.cities?.length || filters.zips?.length || filters.closerIds?.length || filters.outcomes?.length || filters.meetingOrder?.length)
  if (narrowed || !COST_GROUPINGS.includes(groupBy)) {
    reasons.cost = 'Spend is entered per source and month, so cost shows only for totals, sources or months filtered by source alone.'
  }
  else if (filters.leadSourceIds?.includes(null)) {
    reasons.cost = UNKNOWN_SOURCE_COST_REASON
  }
  return reasons
}
