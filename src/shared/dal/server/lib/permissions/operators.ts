import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec } from '../../types'

import type { FieldNode } from './ast'

/**
 * What an operator compiles against: the outer table and its primary key to correlate on, and the
 * same actor's read reach on another entity, so an operator that follows a link reads through the
 * target's own rules.
 */
export interface OperatorContext {
  table: PgTable
  pk: PgColumn
  inReadReach: (spec: AnyServerSpec, fk: PgColumn) => SQL
}

export interface Operator {
  name: string
  toSql: (node: FieldNode, ctx: OperatorContext) => SQL
}

const REGISTRY = new Map<string, Operator>()

export function defineOperator(op: Operator): void {
  if (REGISTRY.has(op.name)) {
    throw new Error(`[permit] operator '${op.name}' is already registered`)
  }
  REGISTRY.set(op.name, op)
}

export function getOperator(name: string): Operator | undefined {
  return REGISTRY.get(name)
}

/**
 * Both directions, at boot: a declared name without a body would fail inside a request; a body
 * without a declaration would never parse, because the conditions matcher only knows declared names.
 */
export function assertRegistryMatchesDeclarations(declared: readonly string[]): void {
  const names = new Set(declared)
  const missing = declared.filter(name => !REGISTRY.has(name))
  const undeclared = [...REGISTRY.keys()].filter(name => !names.has(name))
  if (missing.length > 0 || undeclared.length > 0) {
    throw new Error(`[permit] operators without a body: [${missing.join(', ')}]; bodies without a declaration: [${undeclared.join(', ')}]`)
  }
}
