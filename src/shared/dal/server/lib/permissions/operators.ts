import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { FieldNode } from './ast'

/** The outer table a filter is built for and its primary key, for an operator to correlate on. */
export interface OperatorContext {
  table: PgTable
  pk: PgColumn
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
