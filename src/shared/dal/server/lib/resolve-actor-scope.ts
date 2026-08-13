import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { Actor } from '@/shared/domains/permissions/scope/actor'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { compileScope } from '@/shared/domains/permissions/scope/compile-scope'

/**
 * The spec-aware scope authority (spec §5). Roots compile their conditions;
 * children resolve `own` as verb-only and inherit rows via the structural parent
 * bridge. Replaces `resolveEffectiveScope` once every entity migrates (Phase 5).
 *   null       → no constraint (allow)
 *   sql`false` → deny (own-verb denied)
 */
export function resolveActorScope(spec: EntityServerSpec, actor: Actor): SQL | null {
  const ctx = { table: spec.table, pk: pkColumn(spec), actor }
  const own = spec.parent
    ? verbOnly(actor, 'read', spec.caslSubject) // CHILD: verb-only (spec §5)
    : compileScope(actor, 'read', spec.caslSubject, ctx) // ROOT: full conditional compile
  const bridge = spec.parent
    ? inArray(
        fkColumn(spec),
        db.select({ pk: pkColumn(spec.parent.spec) }).from(spec.parent.spec.table)
          .where(resolveActorScope(spec.parent.spec, actor) ?? sql`true`),
      )
    : null
  return combine(own, bridge)
}

/**
 * Child own-scope is the VERB only — never the parent's row condition compiled
 * against the child table (spec §5, the "missing FROM-clause" hazard).
 * allow → null, deny → sql`false`. Token reach is handled by the bridge.
 */
export function verbOnly(actor: Actor, action: AppAction, subject: AppSubject): SQL | null {
  if (actor.kind === 'system')
    return null
  if (actor.kind === 'token')
    return null
  return actor.ability.can(action, subject) ? null : sql`false`
}

/**
 * Point form (spec §6) — "is a row with `id` reachable by this actor?" — for the
 * create/precursor and standalone probe paths that have no host query. Roots
 * probe with `action` (precursor uses 'read'); children fold through the bridge.
 */
export async function canAccess(
  spec: EntityServerSpec,
  actor: Actor,
  id: string | number,
  action: AppAction = 'read',
): Promise<boolean> {
  const ctx = { table: spec.table, pk: pkColumn(spec), actor }
  // NOTE: the child branch resolves READ visibility regardless of `action`
  // (resolveActorScope is read-only today); thread `action` through the bridge in Phase 4.
  const scope = spec.parent
    ? resolveActorScope(spec, actor)
    : compileScope(actor, action, spec.caslSubject, ctx)
  const [row] = await db
    .select({ ok: sql`1` })
    .from(spec.table)
    .where(and(eq(pkColumn(spec), id), scope ?? undefined))
    .limit(1)
  return !!row
}

/** AND the non-null fragments; both null → null (allow); own=sql`false` → deny. */
function combine(own: SQL | null, bridge: SQL | null): SQL | null {
  const parts = [own, bridge].filter((p): p is SQL => p != null)
  if (parts.length === 0)
    return null
  if (parts.length === 1)
    return parts[0]
  return and(...parts)!
}

/**
 * Local copy of `scope.ts`'s pkColumn (kept private there). Duplicated rather
 * than exported so Phase 0 does not touch the file the old engine lives in;
 * both die together in Phase 5.
 */
function pkColumn(spec: EntityServerSpec): PgColumn {
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const pkName = spec.primaryKey ?? 'id'
  const pk = table[pkName]
  if (!pk)
    throw new Error(`[scope] '${pkName}' is not a column on ${spec.entityName}'s table.`)
  return pk
}

/** The child→parent FK column. `parent.fk` is required in the current spec type. */
function fkColumn(spec: EntityServerSpec): PgColumn {
  if (!spec.parent)
    throw new Error(`[scope] ${spec.entityName} has no parent fk`)
  return spec.parent.fk
}
