import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-scoped: injects ctx.scope = project participation fragment (null for omni). */
export const projectProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveVisibilityScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))

/** Public pass-through for showroom/portfolio reads. */
export const projectPublicProcedure = baseProcedure
