import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { Actor } from './actor'
import type { FieldNode } from './ast'

/**
 * The interpreter threads this to every custom operator: the OUTER subject
 * table/pk being compiled (built by `resolveScope` from the spec in hand — NOT
 * a subject registry, spec §2 "ctx sourcing") plus the acting principal.
 */
export interface OperatorCtx { table: PgTable, pk: PgColumn, actor: Actor }

/**
 * A custom cross-table authorization operator, registered ONCE (spec §4.2).
 * - `toSql`      — emit the correlated SQL in the interpreter (Phase 0).
 * - `parseValue` — condition value → AST node payload; consumed by the CASL
 *   parser seam in **Phase 1** (stored, not wired, here).
 * - `toJS`       — client mirror matcher; added when the Client Mirror lands.
 */
export interface ScopeOperator {
  name: string
  parseValue?: (value: unknown) => unknown
  toSql: (node: FieldNode, ctx: OperatorCtx) => SQL
  toJS?: (node: FieldNode, viewer: Actor) => boolean
}

const REGISTRY = new Map<string, ScopeOperator>()

/** Register a custom operator into all sinks. Throws on duplicate name. */
export function defineScopeOperator(op: ScopeOperator): void {
  if (REGISTRY.has(op.name)) {
    throw new Error(`[scope] operator '${op.name}' is already registered`)
  }
  REGISTRY.set(op.name, op)
}

export function getScopeOperator(name: string): ScopeOperator | undefined {
  return REGISTRY.get(name)
}

/** All registered operator names — used by the Phase-1 exhaustiveness check. */
export function registeredOperatorNames(): string[] {
  return [...REGISTRY.keys()]
}
