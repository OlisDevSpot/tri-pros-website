import type { SQL } from 'drizzle-orm'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { resolveScope } from '@/shared/dal/server/lib/resolve-scope'
import { userActor } from '@/shared/domains/permissions/scope/actor'

/**
 * Compiled scope for a `user` request (spec §4). The COMPILED counterpart to
 * `resolveVisibilityScope` — omni is emergent (super-admin `manage all` → empty
 * AST → null), so there is no `isOmni` pre-check here. Used by MIGRATED roots'
 * procedures.ts only; un-migrated roots keep `resolveVisibilityScope`.
 */
export function resolveActorScope(
  spec: EntityServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  return resolveScope(spec, userActor(auth.userId, auth.ability))
}
