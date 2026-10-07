// The predicate is expressed entirely in the entity's OWN table (parent columns live inside the
// subquery) so it composes into any DAL WHERE as one query, never an N+1.
// Omni is NOT handled here: callers collapse omni → null before invoking, so the recursion never re-checks.

import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, ScopedContext, VisibilityScope } from '@/shared/dal/server/types'
import type { EntitySubject } from '@/shared/domains/permissions/specs'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

import { SERVER_SPECS } from '../specs'
import { subjectOf } from './define-spec'
import { reachFor } from './permissions/core'

/**
 * The subjects whose rules are compiled: their specs declare no `visibility`, and `createCrudDal`
 * scopes them through `permit`. A family joins when it converts; the set and this module go when
 * the last one has.
 */
export const COMPILED_SUBJECTS: ReadonlySet<EntitySubject> = new Set<EntitySubject>(['Customer', 'CustomerNote'])

export function isCompiled(spec: AnyServerSpec): boolean {
  return COMPILED_SUBJECTS.has(subjectOf(spec))
}

// A compiled spec that still declared `visibility` would run on both engines, the legacy one silently.
for (const spec of SERVER_SPECS) {
  if (COMPILED_SUBJECTS.has(subjectOf(spec)) && spec.visibility) {
    throw new Error(`[scope] ${spec.entityName} is compiled and still declares visibility`)
  }
}

export function resolveEffectiveScope(spec: AnyServerSpec, auth: VisibilityScope): SQL {
  const own = spec.visibility?.(auth) ?? null
  const bridge = spec.parent ? bridgeToParent(spec.parent, auth) : null

  const fragments = [own, bridge].filter((f): f is SQL => f != null)
  if (fragments.length === 0) {
    throw new Error(
      `[resolveEffectiveScope] ${spec.entityName} declares neither 'visibility' nor 'parent' — it would be unscoped.`,
    )
  }
  return fragments.length === 1 ? fragments[0] : and(...fragments)!
}

function bridgeToParent(parent: NonNullable<AnyServerSpec['parent']>, auth: VisibilityScope): SQL {
  if (isCompiled(parent.spec)) {
    throw new Error(`[resolveEffectiveScope] ${parent.spec.entityName} is compiled: a family converts its children with it.`)
  }
  const parentScope = resolveEffectiveScope(parent.spec, auth) // recurse up the chain
  return inArray(
    parent.fk,
    db.select({ pk: pkColumn(parent.spec) }).from(parent.spec.table).where(parentScope),
  )
}

/** Point probe for create/precursor paths that have no host query to compose `ctx.scope` into. NEVER call per-row in a loop — that is what the composable predicate is for. */
export async function isVisible(spec: AnyServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
  const { ability, userId } = ctx.actor
  if (userId === null) {
    return true // no user: the system, or a share-link holder whose row the token already pinned
  }
  if (ability.can('manage', 'all')) {
    return true // omni
  }
  if (isCompiled(spec)) {
    return reachFor(ctx, 'read', spec).probe(id)
  }
  const scope = resolveEffectiveScope(spec, { userId, ability })
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), scope))
    .limit(1)
  return !!row
}

/** @deprecated Point probe against the already-resolved `ctx.scope`; use `resolveEffectiveScope` + `isVisible`. Do not add callers. */
export async function isInScope(spec: AnyServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), ctx.scope ?? undefined))
    .limit(1)
  return !!row
}

function pkColumn(spec: AnyServerSpec): PgColumn {
  // Drizzle's PgTable doesn't expose columns as a keyed record, hence the cast.
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const pkName = spec.primaryKey ?? 'id'
  const pk = table[pkName]
  if (!pk) {
    throw new Error(`[scope] '${pkName}' is not a column on ${spec.entityName}'s table.`)
  }
  return pk
}
