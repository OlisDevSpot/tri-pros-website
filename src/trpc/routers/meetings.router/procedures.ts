// Per-entity pre-scoped procedures for the meetings router — defined ONCE here
// as top-level consts, imported directly by every meeting sub-router. Replaces
// the old `createEntityRouter` factory + `EntityToolkit` argument: middleware is
// baked on at definition time, not generated per call.
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.

import { TRPCError } from '@trpc/server'

import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session guaranteed; `ctx.scope` resolved from meeting visibility (null for omni). */
export const meetingProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(meetingServerSpec, { userId: ctx.session.user.id, ability: ctx.actor.ability })
  return next({ ctx: { ...ctx, scope } })
})

/**
 * The visit-message surfaces. No role is granted `VisitMessages`, so only a super-admin passes today.
 * `ctx.scope` stays the meeting scope: a visit message follows its meeting.
 */
export const visitMessagesProcedure = meetingProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('read', 'VisitMessages')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to see visit messages.' })
  }
  return next({ ctx })
})
