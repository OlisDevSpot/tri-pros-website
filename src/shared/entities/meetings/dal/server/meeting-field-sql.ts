import type { SQL } from 'drizzle-orm'

import type { ProposalStatus } from '@/shared/constants/enums/proposals'

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import 'server-only'

/** The setter's user row: `user` is already joined for the owner, so the setter needs its own alias. */
export const setterUser = alias(user, 'setter_user')

// `none` = the meeting has no proposal; any other pick = one of its proposals is in that status. Picks OR together.
function proposalStatusCondition(values: readonly ('none' | ProposalStatus)[]): SQL | undefined {
  const statuses = values.filter((value): value is ProposalStatus => value !== 'none')
  return or(
    values.includes('none') ? sql`NOT EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id})` : undefined,
    statuses.length > 0 ? sql`EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${inArray(proposals.status, statuses)})` : undefined,
  )
}

export const MEETING_FIELD_SQL = defineFieldSql(MEETING_FIELDS, {
  filter: {
    meetingType: v => inArray(meetings.meetingType, v),
    proposalStatus: v => proposalStatusCondition(v),
    // Trade picks are Notion trade ids stored in the flow-state JSON until the SOW moves to columns.
    trade: v => sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${meetings.flowStateJSON} -> 'tradeSelections') AS selection WHERE ${inArray(sql`selection ->> 'tradeId'`, v)})`,
    rep: v => sql`EXISTS (SELECT 1 FROM ${meetingParticipants} WHERE ${meetingParticipants.meetingId} = ${meetings.id} AND ${inArray(meetingParticipants.userId, v)})`,
    setter: v => inArray(meetings.setBy, v),
    leadSource: v => inArray(customers.leadSourceId, v),
    createdAt: v => dateRangeCondition(meetings.createdAt, v),
    scheduledFor: v => dateRangeCondition(meetings.scheduledFor, v),
    outcome: v => inArray(meetings.meetingOutcome, v),
    pipeline: (v) => {
      if (v === 'projects') {
        return sql`${meetings.projectId} IS NOT NULL`
      }
      return and(sql`${meetings.projectId} IS NULL`, eq(meetings.pipeline, v))
    },
  },
  sort: {
    meetingType: meetings.meetingType,
    // The Rep column shows the owner, so it sorts by the owner's name; the Rep filter matches any participant.
    rep: user.name,
    setter: setterUser.name,
    leadSource: leadSourcesTable.name,
    createdAt: meetings.createdAt,
    scheduledFor: meetings.scheduledFor,
    outcome: meetings.meetingOutcome,
    customerName: customers.name,
  },
}, { defaultOrder: [desc(meetings.createdAt)], tieBreaker: meetings.id })
