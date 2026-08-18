import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

import { agentProcedure } from '../../init'
import { resolveTrpcActorScope } from '../../lib/middleware/resolve-trpc-actor-scope'

/**
 * Agent-scoped: injects ctx.scope = project row-visibility predicate, COMPILED
 * from CASL (abilities.ts agent Project rules: participation OR ownerId=me);
 * null for omni (super-admin `manage all` → no constraint). Sourced from
 * `resolveTrpcActorScope` (CASL engine), NOT the legacy `resolveVisibilityScope`
 * — keeps projects on the Phase-1 migration post-`main`-merge (identical
 * signature, so the compiler cannot catch a regression here).
 */
export const projectProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveTrpcActorScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
