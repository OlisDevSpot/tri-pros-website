// The predicate is expressed entirely in the entity's OWN table (parent columns live inside the
// subquery) so it composes into any DAL WHERE as one query, never an N+1.
// Omni is NOT handled here: callers collapse omni → null before invoking, so the recursion never re-checks.

import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { ScopedContext, ServerSpec, VisibilityScope } from '@/shared/dal/server/types'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

export function resolveEffectiveScope(spec: ServerSpec, auth: VisibilityScope): SQL {
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

function bridgeToParent(parent: NonNullable<ServerSpec['parent']>, auth: VisibilityScope): SQL {
  const parentScope = resolveEffectiveScope(parent.spec, auth) // recurse up the chain
  return inArray(
    parent.fk,
    db.select({ pk: pkColumn(parent.spec) }).from(parent.spec.table).where(parentScope),
  )
}

/** Point probe for create/precursor paths that have no host query to compose `ctx.scope` into. NEVER call per-row in a loop — that is what the composable predicate is for. */
export async function isVisible(spec: ServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
  if (!ctx.session) {
    return true // SYSTEM_CONTEXT — unrestricted
  }
  if (ctx.ability?.can('manage', 'all')) {
    return true // omni
  }
  const scope = resolveEffectiveScope(spec, { userId: ctx.session.user.id, ability: ctx.ability! })
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), scope))
    .limit(1)
  return !!row
}

/** @deprecated Point probe against the already-resolved `ctx.scope`; use `resolveEffectiveScope` + `isVisible`. Do not add callers. */
export async function isInScope(spec: ServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), ctx.scope ?? undefined))
    .limit(1)
  return !!row
}

function pkColumn(spec: ServerSpec): PgColumn {
  // Drizzle's PgTable doesn't expose columns as a keyed record, hence the cast.
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const pkName = spec.primaryKey ?? 'id'
  const pk = table[pkName]
  if (!pk) {
    throw new Error(`[scope] '${pkName}' is not a column on ${spec.entityName}'s table.`)
  }
  return pk
}
