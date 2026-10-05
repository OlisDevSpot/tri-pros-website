import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'
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
  next({ ctx: {
    ...ctx,
    scope: resolveTrpcActorScope(projectServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }),
  } }))

/**
 * Agent-scoped to the project-media CHILD entity: `ctx.scope` is the parent
 * bridge `projectId IN (SELECT projects.id WHERE <CASL project read scope>)`
 * (null for omni). Sourced from the CASL engine (`resolveTrpcActorScope`), NOT
 * the legacy `resolveVisibilityScope` — `projectServerSpec` declares no legacy
 * `visibility` fn, so a legacy bridge would throw. CASL `read Project` =
 * participation OR ownerId=me, so the bridge is genuinely scoped; a dispatcher
 * (no `read Project` grant) resolves to deny → sees zero project media.
 */
export const projectMediaProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: {
    ...ctx,
    scope: resolveTrpcActorScope(mediaFileServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }),
  } }))
