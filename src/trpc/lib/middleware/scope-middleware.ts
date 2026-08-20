// Scope-resolving helper. see ../../DOCS.md#scope-middleware-is-the-core-superpower
// Chain after agentProcedure (which guarantees session + ability non-null).

import type { SQL } from 'drizzle-orm'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'

/**
 * Pure scope resolver: `null` for omni (super-admin), else the entity's
 * EFFECTIVE visibility predicate (own fragment + parent bridge for
 * sub-entities). Omni lives here — a procedure/context concern — never inside
 * the entity's `visibility` fragment. Called by the legacy `createCrudRouter`
 * factory and by the un-migrated per-entity `procedures.ts` inline chains so the
 * two can never drift. see ../../DOCS.md#scope-middleware-is-the-core-superpower
 */
export function resolveVisibilityScope(
  spec: EntityServerSpec,
  auth: { userId: string, ability: AppAbility },
): SQL | null {
  const isOmni = auth.ability.can('manage', 'all')
  return isOmni ? null : resolveEffectiveScope(spec, { userId: auth.userId, ability: auth.ability })
}
