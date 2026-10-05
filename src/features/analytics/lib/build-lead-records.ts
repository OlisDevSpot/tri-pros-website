import type { AnalyticsFacts, LeadMeeting, LeadRecord, LeadRecordSet, LeadSale } from '@/features/analytics/types'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'

import { deriveMeetingOrder, isUnresolvedMeeting, pickBookedLead, pickLeadAnchor } from '@/features/analytics/lib/analytics-rules'
import { isProjectMeeting, MEETING_OUTCOME_SIT } from '@/shared/constants/enums/meetings'
import { compareRecordAge, groupDuplicatePeople } from '@/shared/entities/customers/lib/group-duplicate-people'
import { classifySale } from '@/shared/modules/proposals/core/lib/sale'

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? []
  list.push(value)
  map.set(key, list)
}

export function buildLeadRecords(facts: AnalyticsFacts, now: Date): LeadRecordSet {
  const personOf = groupDuplicatePeople(facts.customers)
  let orphans = 0

  const recordsByPerson = new Map<string, CustomerFact[]>()
  for (const record of facts.customers) {
    pushTo(recordsByPerson, personOf.get(record.id)!, record)
  }

  const meetingById = new Map(facts.meetings.map(m => [m.id, m]))
  const meetingsByPerson = new Map<string, MeetingFact[]>()
  for (const m of facts.meetings) {
    const personId = m.customerId ? personOf.get(m.customerId) : undefined
    if (!personId) {
      orphans++
      continue
    }
    pushTo(meetingsByPerson, personId, m)
  }

  const salesByPerson = new Map<string, LeadSale[]>()
  for (const s of facts.sales) {
    const saleMeeting = s.meetingId ? meetingById.get(s.meetingId) : undefined
    const personId = saleMeeting?.customerId ? personOf.get(saleMeeting.customerId) : undefined
    if (!saleMeeting || !personId) {
      orphans++
      continue
    }
    pushTo(salesByPerson, personId, {
      proposalId: s.id,
      meetingId: saleMeeting.id,
      ...classifySale(s),
      closerIds: saleMeeting.closerIds,
      hasProject: saleMeeting.projectId !== null,
    })
  }

  const leads: LeadRecord[] = [...recordsByPerson].map(([personId, records]) => {
    const chronological = (meetingsByPerson.get(personId) ?? [])
      .map(m => ({
        id: m.id,
        at: m.scheduledFor,
        outcome: m.meetingOutcome,
        sit: MEETING_OUTCOME_SIT[m.meetingOutcome],
        project: isProjectMeeting(m),
        closerIds: m.closerIds,
      }))
      .sort((a, b) => compareRecordAge({ id: a.id, createdAt: a.at }, { id: b.id, createdAt: b.at }))
    const orders = deriveMeetingOrder(chronological)
    const meetings: LeadMeeting[] = chronological.map((m, index) => ({
      ...m,
      order: orders[index],
      unresolved: isUnresolvedMeeting(m, now),
    }))
    return {
      personId,
      customerIds: records.map(r => r.id),
      ...pickLeadAnchor(records),
      quality: 'unknown',
      meetings,
      bookedLead: pickBookedLead(meetings),
      sales: salesByPerson.get(personId) ?? [],
    }
  })

  return { leads, orphans }
}
