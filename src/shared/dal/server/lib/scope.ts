// Visibility scope engine. see docs/codebase-conventions/dal-conventions.md
//
// `resolveEffectiveScope` is the single source of an entity's visibility
// predicate. For a top-level entity it's just the entity's own `visibility`
// fragment; for a sub-entity (one declaring `parent`) it ADDITIVELY composes
// the own fragment with a correlated bridge to the parent's OWN effective
// scope, recursing up the parent chain:
//
//   fk IN (SELECT parent.pk FROM parent WHERE <parent effective scope>)
//
// The result is expressed entirely in the entity's OWN table (parent columns
// live inside the subquery), so it drops straight into the existing
// `and(eq(pk, id), ctx.scope ?? undefined)` at every DAL call site — reads,
// updates, deletes, batch writes — as one composed query, never an N+1.
//
// OMNI IS NOT HANDLED HERE. The three callers (resolveVisibilityScope,
// buildUserContext, shareableMiddleware) collapse omni → null BEFORE invoking
// this, exactly as they did for `spec.visibility`. A non-omni caller is
// non-omni at every level, so the recursion never re-checks.

import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec, ScopedContext, VisibilityScope } from '@/shared/dal/server/types'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

/**
 * The effective visibility predicate for `spec`: its own `visibility` fragment
 * AND — if it declares a `parent` — a correlated bridge to the parent's own
 * effective scope. Recurses up the parent chain. Throws if the entity declares
 * neither (it would otherwise be unrestricted — a misconfiguration, not a
 * feature: there are no escape hatches). Callers pass a non-omni `auth`.
 */
export function resolveEffectiveScope(spec: EntityServerSpec, auth: VisibilityScope): SQL {
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

/** `childFk IN (SELECT parent.pk FROM parent WHERE <parent effective scope>)`. */
function bridgeToParent(parent: NonNullable<EntityServerSpec['parent']>, auth: VisibilityScope): SQL {
  const parentScope = resolveEffectiveScope(parent.spec, auth) // recurse up the chain
  return inArray(
    parent.fk,
    db.select({ pk: pkColumn(parent.spec) }).from(parent.spec.table).where(parentScope),
  )
}

/**
 * Point form of `resolveEffectiveScope` — "is a row with `id` visible?" — for
 * the create / precursor paths that have NO host query to compose the bridge
 * into (e.g. media `create`, `getUploadUrl`, which authorize against a PARENT
 * row before any child row exists). `ctx.scope == null` with no session is
 * SYSTEM_CONTEXT; omni short-circuits true. NEVER call this per-row in a loop —
 * that's what the composable `ctx.scope` predicate is for.
 */
export async function isVisible(spec: EntityServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
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

/**
 * @deprecated Legacy point probe against the already-resolved `ctx.scope`.
 * Superseded by `resolveEffectiveScope` (composable) + `isVisible` (point form
 * that re-resolves from a spec). Retained only until its remaining callers
 * (proposal-views, proposal-media authz) migrate to the bridge. Do not add new
 * callers.
 */
export async function isInScope(spec: EntityServerSpec, ctx: ScopedContext, id: string | number): Promise<boolean> {
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), ctx.scope ?? undefined))
    .limit(1)
  return !!row
}

/** Look up an entity's primary-key column by name (defaults to `id`). */
function pkColumn(spec: EntityServerSpec): PgColumn {
  // Cast: Drizzle's PgTable doesn't expose columns as a keyed record; look the
  // primary-key column up by name (same pattern as shareable-middleware).
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const pkName = spec.primaryKey ?? 'id'
  const pk = table[pkName]
  if (!pk) {
    throw new Error(`[scope] '${pkName}' is not a column on ${spec.entityName}'s table.`)
  }
  return pk
}
