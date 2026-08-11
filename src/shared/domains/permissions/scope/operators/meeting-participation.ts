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
 *
 * Registry `name` has NO leading `$`, even though rules are authored with one
 * (`can('read','Customer',{ $participatesViaMeeting: {...} })`). Verified
 * against the installed @casl/ability@6.8.0 / @ucast/mongo@2.4.3: CASL's
 * `MongoQueryParser` hardcodes `operatorToConditionName: e => e.slice(1)` in
 * its OWN constructor and does NOT forward `buildMongoQueryMatcher`'s options
 * arg to it — so the leading `$` is unconditionally stripped from every
 * parsed node's `operator`, standard (`$eq`→`eq`) and custom alike. That's
 * why `interpretField` already switches on `'eq'`/`'in'` without `$`; this
 * registry follows the same, empirically-verified convention. See
 * conditions-matcher.ts for how the `$`-prefixed condition key maps back to
 * this unprefixed registry name.
 */
defineScopeOperator({
  name: 'participatesViaMeeting',
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
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
            .where(and(eq(meetingParticipants.meetingId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'customerId': // Customer subject: meetings.customer_id = customers.id.
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.customerId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'projectId': // Project subject: meetings.project_id = projects.id.
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetings)
            .innerJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
            .where(and(eq(meetings.projectId, ctx.pk), eq(meetingParticipants.userId, userId))),
        )
      case 'meetingId': // Proposal subject: correlate on the subject's OWN fk column.
        return exists(
          db.select({ id: meetingParticipants.id }).from(meetingParticipants)
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
  name: 'hasNoMeeting',
  toSql: (_node, ctx) =>
    not(exists(db.select({ x: sql`1` }).from(meetings).where(eq(meetings.customerId, ctx.pk)))),
})
