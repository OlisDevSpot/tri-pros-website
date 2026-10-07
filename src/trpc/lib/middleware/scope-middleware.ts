// The legacy row filter for one spec and one user. Shared by `createCrudRouter` and the per-entity procedures.

import type { SQL } from 'drizzle-orm'

import type { AnyServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'

/**
 * Pure scope resolver: `null` for omni (super-admin), else the entity's
 * EFFECTIVE visibility predicate (own fragment + parent bridge for
 * sub-entities). Omni lives here — a procedure/context concern — never inside
 * the entity's `visibility` fragment. Shared by the legacy factory and the
 * per-entity `procedures.ts` inline chains so the two can never drift.
 */
export function resolveVisibilityScope(
  spec: AnyServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  const isOmni = auth.ability.can('manage', 'all')
  return isOmni ? null : resolveEffectiveScope(spec, { userId: auth.userId, ability: auth.ability })
}
