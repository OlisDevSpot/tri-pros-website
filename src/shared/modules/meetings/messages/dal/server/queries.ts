import type { SQL } from 'drizzle-orm'

import type { Meeting } from '@/shared/db/schema'
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'

import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'

export interface VisitMessageContext {
  meeting: Pick<Meeting, 'id' | 'customerId' | 'ownerId' | 'scheduledFor' | 'scheduledForSetAt' | 'meetingType' | 'meetingOutcome' | 'confirmedAt' | 'homeownerConfirmedAt' | 'homeownerConfirmedVia' | 'shareToken'>
  customer: {
    id: string
    name: string
    /** Bare national digits, as stored. */
    phone: string | null
    email: string | null
    address: string | null
    city: string
    state: string | null
    zip: string
    doNotContact: boolean
  } | null
  /** The specialist: the owner participant. Null for a system-owned meeting, which has none. */
  rep: { userId: string, name: string, nickname: string | null } | null
  /** The meeting's setter. Null when nobody set it or the company's own account did; the texts then speak as the company. */
  coordinator: { userId: string, name: string, nickname: string | null } | null
}

const coordinatorUser = alias(user, 'coordinator_user')

// Unscoped: jobs and webhooks read these, and a procedure that reaches them has checked the meeting first.
async function listContexts(where: SQL): Promise<VisitMessageContext[]> {
  const rows = await db
    .select({
      meeting: {
        id: meetings.id,
        customerId: meetings.customerId,
        ownerId: meetings.ownerId,
        scheduledFor: meetings.scheduledFor,
        scheduledForSetAt: meetings.scheduledForSetAt,
        meetingType: meetings.meetingType,
        meetingOutcome: meetings.meetingOutcome,
        confirmedAt: meetings.confirmedAt,
        homeownerConfirmedAt: meetings.homeownerConfirmedAt,
        homeownerConfirmedVia: meetings.homeownerConfirmedVia,
        shareToken: meetings.shareToken,
      },
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        city: customers.city,
        state: customers.state,
        zip: customers.zip,
        dncOptedOutAt: customers.dncOptedOutAt,
      },
      rep: { userId: user.id, name: user.name, nickname: user.nickname },
      coordinator: { userId: coordinatorUser.id, name: coordinatorUser.name, nickname: coordinatorUser.nickname, email: coordinatorUser.email },
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .leftJoin(meetingParticipants, and(eq(meetingParticipants.meetingId, meetings.id), eq(meetingParticipants.role, 'owner')))
    .leftJoin(user, eq(user.id, meetingParticipants.userId))
    .leftJoin(coordinatorUser, eq(coordinatorUser.id, meetings.setBy))
    .where(where)
    .orderBy(asc(meetings.scheduledFor))

  // A leftJoin miss yields an all-null object rather than null.
  return rows.map(row => ({
    meeting: row.meeting,
    customer: row.customer?.id
      ? {
          id: row.customer.id,
          name: row.customer.name!,
          phone: row.customer.phone,
          email: row.customer.email,
          address: row.customer.address,
          city: row.customer.city!,
          state: row.customer.state,
          zip: row.customer.zip!,
          doNotContact: row.customer.dncOptedOutAt != null,
        }
      : null,
    rep: row.rep?.userId ? { userId: row.rep.userId, name: row.rep.name!, nickname: row.rep.nickname } : null,
    coordinator: row.coordinator?.userId && row.coordinator.email !== SYSTEM_OWNER_EMAIL
      ? { userId: row.coordinator.userId, name: row.coordinator.name!, nickname: row.coordinator.nickname }
      : null,
  }))
}

export async function getVisitMessageContext(meetingId: string): Promise<VisitMessageContext | undefined> {
  const [context] = await listContexts(eq(meetings.id, meetingId))
  return context
}

/** Every meeting whose time falls in a half-open window of instants, soonest first. */
export async function listVisitMessageContexts(window: { from: string, to: string }): Promise<VisitMessageContext[]> {
  return listContexts(and(gte(meetings.scheduledFor, window.from), lt(meetings.scheduledFor, window.to))!)
}

/** Every visit message across a reschedule chain, oldest first. */
export async function listChainMessages(meetingIds: string[]): Promise<MeetingMessage[]> {
  if (meetingIds.length === 0) {
    return []
  }
  return db
    .select()
    .from(meetingMessages)
    .where(inArray(meetingMessages.meetingId, meetingIds))
    .orderBy(asc(meetingMessages.createdAt))
}
