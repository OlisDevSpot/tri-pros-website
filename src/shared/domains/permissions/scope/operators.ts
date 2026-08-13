import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { Actor } from './actor'
import type { FieldNode } from './ast'

/**
 * The interpreter threads this to every custom operator: the OUTER subject
 * table/pk being compiled (built by `resolveActorScope` from the spec in hand — NOT
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

/** All registered operator names (those with a `toSql` body). */
export function registeredOperatorNames(): string[] {
  return [...REGISTRY.keys()]
}

/**
 * Server-side boot assert: the runtime registry (operators with a `toSql`) must
 * match the static `SCOPE_OPERATOR_NAMES` contract exactly, in both directions.
 * The client-safe surfaces (matcher + exhaustiveness) validate against the
 * static contract; this closes the loop on the server, where the impls actually
 * load. `missingImpl` = declared name with no `toSql` (a rule using it would
 * fail deep in the interpreter); `undeclared` = a `toSql` the contract never
 * lists (invisible to the matcher, so its rules never parse). Either is a wiring
 * bug — fail loud at boot, not per-request. Called from interpret.ts, after its
 * operator side-effect imports have populated the registry.
 */
export function assertRegistryMatchesContract(contract: readonly string[]): void {
  const declared = new Set(contract)
  const missingImpl = contract.filter(name => !REGISTRY.has(name))
  const undeclared = [...REGISTRY.keys()].filter(name => !declared.has(name))
  if (missingImpl.length || undeclared.length) {
    throw new Error(
      `[scope] operator registry ↔ contract mismatch: missingImpl=[${missingImpl.join(', ')}] undeclared=[${undeclared.join(', ')}]`,
    )
  }
}
