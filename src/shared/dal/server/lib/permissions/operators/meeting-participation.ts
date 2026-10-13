import { and, eq, exists } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers, meetingParticipants, meetings, projects, proposals } from '@/shared/db/schema'

import { defineOperator } from '../operators'

type Via = 'customerId' | 'meetingId' | 'projectId' | 'self'

// One atom, three join shapes. `userId` travels inside the rule's condition, because rules are built
// per user, so the operator never asks who is acting. Registered without the `$`: CASL's parser strips
// it from every node's `operator`, built-in and custom alike.
defineOperator({
  name: 'participatesViaMeeting',
  toSql: (node, ctx) => {
    const { via, userId } = node.value as { via: Via, userId: string }
    switch (via) {
      case 'self':
        // The correlation column belongs to that table, so any other outer table would be a wrong join.
        if (ctx.table !== meetings) {
          throw new Error(`[permit] $participatesViaMeeting via 'self' sits on Meeting only`)
        }
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'customerId':
        if (ctx.table !== customers) {
          throw new Error(`[permit] $participatesViaMeeting via 'customerId' sits on Customer only`)
        }
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.customerId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'projectId':
        if (ctx.table !== projects) {
          throw new Error(`[permit] $participatesViaMeeting via 'projectId' sits on Project only`)
        }
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.projectId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'meetingId':
        if (ctx.table !== proposals) {
          throw new Error(`[permit] $participatesViaMeeting via 'meetingId' sits on Proposal only`)
        }
        // A proposal correlates on its own foreign key, not its primary key.
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, proposals.meetingId), eq(meetingParticipants.userId, userId))),
        )
      default:
        throw new Error(`[permit] $participatesViaMeeting: unknown via '${String(via)}'`)
    }
  },
})
