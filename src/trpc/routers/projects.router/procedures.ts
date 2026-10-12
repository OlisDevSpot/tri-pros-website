import { TRPCError } from '@trpc/server'

import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-scoped: injects ctx.scope = project participation fragment (null for omni). */
export const projectProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveVisibilityScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.actor.ability }) } }))

// Project rows are not on compiled rules yet and these procedures run unscoped, so a dashboard role
// without any Project rule (the dispatcher) must be refused before the handler reaches a row.
export const projectAccessProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('read', 'Project')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access projects' })
  }
  return await next({ ctx })
})
