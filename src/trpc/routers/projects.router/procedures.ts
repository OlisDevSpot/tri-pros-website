import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-scoped: injects ctx.scope = project participation fragment (null for omni). */
export const projectProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveVisibilityScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
