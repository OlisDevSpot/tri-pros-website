import { and, eq, exists, not, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingParticipants, meetings, proposals } from '@/shared/db/schema'

import { defineScopeOperator } from '../operators'

type ParticipationVia = 'customerId' | 'meetingId' | 'projectId' | 'self'

/**
 * "The acting user participates in a meeting reachable from this row."
 * ONE named atom, but three distinct join topologies (spec §4.2) — the operator
 * body switches on `via`. Correlates to the outer subject via `ctx.pk`, except
 * `meetingId` (Proposal), which correlates on the subject's own FK column
 * `proposals.meeting_id`.
 */
defineScopeOperator({
  name: '$participatesViaMeeting',
  parseValue: value => value, // { via } — consumed by the CASL parser seam in Phase 1
  toSql: (node, ctx) => {
    if (ctx.actor.kind !== 'user') {
      // Custom operators only appear on `user` (role) rules; token/system never
      // reach the interpreter (compileScope short-circuits them).
      throw new Error(`[scope] $participatesViaMeeting reached with actor.kind='${ctx.actor.kind}'`)
    }
    const userId = ctx.actor.userId
    const { via } = (node.value ?? {}) as { via: ParticipationVia }

    switch (via) {
      case 'self': // Meeting subject: participants directly on the outer meeting row.
        return exists(
          db.select({ x: sql`1` }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'customerId': // Customer subject: meetings.customer_id = customers.id.
        return exists(
          db.select({ x: sql`1` }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.customerId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'projectId': // Project subject: meetings.project_id = projects.id.
        return exists(
          db.select({ x: sql`1` }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.projectId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'meetingId': // Proposal subject: correlate on the subject's OWN fk column.
        return exists(
          db.select({ x: sql`1` }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, proposals.meetingId), eq(meetingParticipants.userId, userId))),
        )
      default:
        throw new Error(`[scope] $participatesViaMeeting: unknown via '${String(via)}'`)
    }
  },
})

/**
 * "This customer has no meeting yet" — the unclaimed-leads-pool predicate
 * (spec §4.3; mirrors `leadsPoolVisibility()` at
 * customers/dal/server/visibility.ts:22). Correlates on `ctx.pk` = customers.id.
 */
defineScopeOperator({
  name: '$hasNoMeeting',
  toSql: (_node, ctx) =>
    not(exists(db.select({ x: sql`1` }).from(meetings).where(eq(meetings.customerId, ctx.pk)))),
})
