import type { AnalyticsRateKey } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsCounts, AnalyticsFilters, AnalyticsGroupBy, AnalyticsResult, LeadMeeting, LeadRecord, LeadRecordSet, LeadSale, MeetingOrder } from '@/features/analytics/types'
import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

import { ANALYTICS_RATES, computeRate, inapplicableStages, mergedRecordCount } from '@/features/analytics/lib/analytics-rules'
import { businessMonthKey } from '@/shared/lib/business-time'

interface EventDimensions {
  at: string | null
  closerIds?: string[]
  outcome?: MeetingOutcome
  order?: MeetingOrder
}

interface Tally {
  leads: number
  mergedRecords: number
  unknownCityZip: number
  bookedLeads: number
  sits: number
  meetings: number
  unresolvedMeetings: number
  newSales: number
  totalCloses: number
  revenueNewCents: number
  revenueUpsellCents: number
  newSalesWithValue: number
  salesWithoutValue: number
  newSalesWithoutProject: number
}

function emptyTally(): Tally {
  return { leads: 0, mergedRecords: 0, unknownCityZip: 0, bookedLeads: 0, sits: 0, meetings: 0, unresolvedMeetings: 0, newSales: 0, totalCloses: 0, revenueNewCents: 0, revenueUpsellCents: 0, newSalesWithValue: 0, salesWithoutValue: 0, newSalesWithoutProject: 0 }
}

function matches<T>(allowed: readonly T[] | undefined, value: T): boolean {
  return !allowed?.length || allowed.includes(value)
}

function groupKeys(groupBy: AnalyticsGroupBy, person: LeadRecord, event: EventDimensions): (string | null)[] {
  switch (groupBy) {
    case 'total':
      return ['total']
    case 'leadSource':
      return [person.leadSourceId]
    case 'city':
      return [person.city]
    case 'zip':
      return [person.zip]
    case 'month':
      return [event.at === null ? null : businessMonthKey(event.at)]
    case 'closer':
      if (!event.closerIds) {
        return []
      }
      // A meeting booked without a closer still happened; it keeps a row (null = unassigned) instead of vanishing.
      return event.closerIds.length ? event.closerIds : [null]
    case 'outcome':
      return event.outcome ? [event.outcome] : []
    case 'meetingOrder':
      return event.order ? [event.order] : []
  }
}

export function aggregateLeadRecords(records: LeadRecordSet, filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): AnalyticsResult {
  const notApplicable = inapplicableStages(filters, groupBy)
  const leadsApplicable = !notApplicable.includes('leads')
  const salesApplicable = !notApplicable.includes('sales')

  const fromMs = filters.range ? Date.parse(filters.range.from) : null
  const toMs = filters.range ? Date.parse(filters.range.to) : null
  const inRange = (at: string | null): boolean => {
    if (fromMs === null || toMs === null) {
      return true
    }
    if (at === null) {
      return false
    }
    const ms = Date.parse(at)
    return ms >= fromMs && ms < toMs
  }

  const meetingPasses = (m: LeadMeeting) =>
    (!filters.closerIds?.length || m.closerIds.some(id => filters.closerIds!.includes(id)))
    && matches(filters.outcomes, m.outcome)
    && matches(filters.meetingOrder, m.order)
  const salePasses = (s: LeadSale) =>
    !filters.closerIds?.length || s.closerIds.some(id => filters.closerIds!.includes(id))

  const tallies = new Map<string | null, Tally>()
  const tallyFor = (key: string | null) => {
    const tally = tallies.get(key) ?? emptyTally()
    tallies.set(key, tally)
    return tally
  }
  if (groupBy === 'total') {
    tallyFor('total')
  }

  let undatedSales = 0
  const leads = records.leads.filter(p =>
    matches(filters.leadSourceIds, p.leadSourceId) && matches(filters.cities, p.city) && matches(filters.zips, p.zip))

  for (const person of leads) {
    if (leadsApplicable && inRange(person.leadAt)) {
      for (const key of groupKeys(groupBy, person, { at: person.leadAt })) {
        const tally = tallyFor(key)
        tally.leads++
        tally.mergedRecords += mergedRecordCount(person)
        if (person.city === null || person.zip === null) {
          tally.unknownCityZip++
        }
      }
    }

    const booked = person.bookedLead
    const bookedMeeting = booked && person.meetings.find(m => m.id === booked.meetingId)
    if (booked && bookedMeeting && inRange(booked.at) && meetingPasses(bookedMeeting)) {
      for (const key of groupKeys(groupBy, person, { at: booked.at, closerIds: bookedMeeting.closerIds, outcome: bookedMeeting.outcome, order: bookedMeeting.order })) {
        const tally = tallyFor(key)
        tally.bookedLeads++
        if (booked.sat) {
          tally.sits++
        }
      }
    }

    for (const m of person.meetings) {
      if (!inRange(m.at) || !meetingPasses(m)) {
        continue
      }
      for (const key of groupKeys(groupBy, person, { at: m.at, closerIds: m.closerIds, outcome: m.outcome, order: m.order })) {
        const tally = tallyFor(key)
        tally.meetings++
        if (m.unresolved) {
          tally.unresolvedMeetings++
        }
      }
    }

    if (!salesApplicable) {
      continue
    }
    for (const s of person.sales) {
      if (!salePasses(s)) {
        continue
      }
      if (s.at === null) {
        undatedSales++
      }
      if (!inRange(s.at)) {
        continue
      }
      for (const key of groupKeys(groupBy, person, { at: s.at, closerIds: s.closerIds })) {
        const tally = tallyFor(key)
        tally.totalCloses++
        if (s.kind === 'new') {
          tally.newSales++
          if (!s.hasProject) {
            tally.newSalesWithoutProject++
          }
        }
        if (s.valueCents === null) {
          tally.salesWithoutValue++
        }
        else if (s.kind === 'new') {
          tally.revenueNewCents += s.valueCents
          tally.newSalesWithValue++
        }
        else {
          tally.revenueUpsellCents += s.valueCents
        }
      }
    }
  }

  const rows: AnalyticsCounts[] = [...tallies].map(([groupKey, t]) => {
    const leads = leadsApplicable ? t.leads : null
    const newSales = salesApplicable ? t.newSales : null
    const stages = { validLeads: leads, bookedLeads: t.bookedLeads, sits: t.sits, newSales }
    const rates = {} as Record<AnalyticsRateKey, number | null>
    for (const rateKey of Object.keys(ANALYTICS_RATES) as AnalyticsRateKey[]) {
      const { numerator, denominator } = ANALYTICS_RATES[rateKey]
      rates[rateKey] = computeRate(stages[numerator], stages[denominator])
    }
    return {
      groupKey,
      overlapsTotal: groupBy === 'closer',
      totalLeads: leads,
      mergedRecords: leadsApplicable ? t.mergedRecords : null,
      validLeads: leads,
      junkLeads: null,
      bookedLeads: t.bookedLeads,
      sits: t.sits,
      meetings: t.meetings,
      newSales,
      totalCloses: salesApplicable ? t.totalCloses : null,
      revenueNewCents: salesApplicable ? t.revenueNewCents : null,
      revenueUpsellCents: salesApplicable ? t.revenueUpsellCents : null,
      averageTicketCents: salesApplicable && t.newSalesWithValue > 0 ? Math.round(t.revenueNewCents / t.newSalesWithValue) : null,
      rates,
      hygiene: {
        unresolvedMeetings: t.unresolvedMeetings,
        salesWithoutValue: salesApplicable ? t.salesWithoutValue : null,
        newSalesWithoutProject: salesApplicable ? t.newSalesWithoutProject : null,
        unknownCityZip: leadsApplicable ? t.unknownCityZip : null,
      },
    }
  })

  rows.sort((a, b) => {
    if (a.groupKey === b.groupKey) {
      return 0
    }
    if (a.groupKey === null) {
      return 1
    }
    if (b.groupKey === null) {
      return -1
    }
    return a.groupKey < b.groupKey ? -1 : 1
  })

  return { rows, notApplicable, undatedSales: salesApplicable ? undatedSales : null, orphans: records.orphans }
}
