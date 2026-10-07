import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { CompoundNode, FieldNode, ScopeNode } from './ast'
import type { OperatorContext } from './operators'

import { and, eq, inArray, isNull, not, or, sql } from 'drizzle-orm'

import { OPERATOR_NAMES } from '@/shared/domains/permissions/operators'

import { isCompound } from './ast'
import { assertRegistryMatchesDeclarations, getOperator } from './operators'

import './operators/meeting-participation'
import './operators/derived-pipeline'

// Runs once the two modules above have registered their bodies; the declarations are client-safe and hold no SQL.
assertRegistryMatchesDeclarations(OPERATOR_NAMES)

/** One rule's conditions as a predicate on `ctx.table`. Always a real SQL value; an unknown operator throws rather than guessing. */
export function interpret(node: ScopeNode, ctx: OperatorContext): SQL {
  // A document operator parses to `{ operator, value }` with no `field`, which `isCompound` would misfile.
  const custom = getOperator(node.operator)
  if (custom) {
    return custom.toSql(node as FieldNode, ctx)
  }
  return isCompound(node) ? interpretCompound(node, ctx) : interpretField(node, ctx)
}

function interpretCompound(node: CompoundNode, ctx: OperatorContext): SQL {
  if (node.operator === 'not') {
    const [child] = node.value
    return child ? not(interpret(child, ctx)) : sql`false`
  }
  if (node.operator !== 'and' && node.operator !== 'or') {
    throw new Error(`[permit] unsupported compound operator '${node.operator}'`)
  }
  const parts = node.value.map(child => interpret(child, ctx))
  if (parts.length === 0) {
    return node.operator === 'and' ? sql`true` : sql`false`
  }
  if (parts.length === 1) {
    return parts[0]!
  }
  return node.operator === 'or' ? or(...parts)! : and(...parts)!
}

function interpretField(node: FieldNode, ctx: OperatorContext): SQL {
  const column = columnOf(ctx, node.field)
  switch (node.operator) {
    case 'eq':
      // `null` matches rows with no value, as CASL's matcher does on the client.
      return node.value === null ? isNull(column) : eq(column, node.value as never)
    case 'in': {
      const values = node.value as readonly unknown[]
      return values.length === 0 ? sql`false` : inArray(column, values as never[])
    }
    default:
      throw new Error(`[permit] unsupported field operator '${node.operator}' on '${node.field}'`)
  }
}

function columnOf(ctx: OperatorContext, field: string): PgColumn {
  const column = (ctx.table as unknown as Record<string, PgColumn | undefined>)[field]
  if (!column) {
    throw new Error(`[permit] '${field}' is not a column of the table`)
  }
  return column
}
