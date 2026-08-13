import type { SQL } from 'drizzle-orm'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { userActor } from '@/shared/domains/permissions/scope/actor'

/**
 * Compiled scope for a `user` request (spec §4). The COMPILED counterpart to
 * `resolveVisibilityScope` — omni is emergent (super-admin `manage all` → empty
 * AST → null), so there is no `isOmni` pre-check here. Used by MIGRATED roots'
 * procedures.ts only; un-migrated roots keep `resolveVisibilityScope`.
 *
 * tRPC-specific wrapper: always builds a `userActor` from the request session.
 * The general actor-agnostic authority is `resolveActorScope` in the DAL.
 */
export function resolveTrpcActorScope(
  spec: EntityServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  return resolveActorScope(spec, userActor(auth.userId, auth.ability))
}
