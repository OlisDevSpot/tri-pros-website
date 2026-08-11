import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { CompoundNode, FieldNode, ScopeNode } from './ast'
import type { OperatorCtx } from './operators'

import { and, eq, inArray, or } from 'drizzle-orm'

import { isCompound } from './ast'
import { getScopeOperator } from './operators'

import './operators/meeting-participation' // registers the domain operators

/**
 * Hand-walk the ucast AST → Drizzle SQL (spec §4). Standard field/compound
 * operators are handled inline; any other operator is a registered custom one.
 * Returns `null` for an empty AND (`buildAnd([])` = unconditional allow), which
 * the caller maps to "no WHERE".
 */
export function interpret(node: ScopeNode, ctx: OperatorCtx): SQL | null {
  return isCompound(node) ? interpretCompound(node, ctx) : interpretField(node, ctx)
}

function interpretCompound(node: CompoundNode, ctx: OperatorCtx): SQL | null {
  const parts = node.value
    .map(child => interpret(child, ctx))
    .filter((p): p is SQL => p != null)
  if (parts.length === 0)
    return null // empty AND → unconditional allow
  if (parts.length === 1)
    return parts[0]
  return node.operator === 'or' ? or(...parts)! : and(...parts)!
}

function interpretField(node: FieldNode, ctx: OperatorCtx): SQL {
  const custom = getScopeOperator(node.operator)
  if (custom)
    return custom.toSql(node, ctx)

  const column = columnOf(ctx, node.field)
  switch (node.operator) {
    case 'eq':
      return eq(column, node.value as never)
    case 'in':
      return inArray(column, node.value as never[])
    default:
      throw new Error(`[scope] unsupported field operator '${node.operator}' on '${node.field}'`)
  }
}

/** Look up a column on the subject table by name (same pattern as pkColumn). */
function columnOf(ctx: OperatorCtx, field: string): PgColumn {
  const col = (ctx.table as unknown as Record<string, PgColumn | undefined>)[field]
  if (!col)
    throw new Error(`[scope] '${field}' is not a column on the subject table`)
  return col
}
