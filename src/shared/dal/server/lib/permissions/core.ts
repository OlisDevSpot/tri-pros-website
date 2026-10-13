import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, ScopedContext } from '../../types'
import type { AppAbility, CrudAction } from '@/shared/domains/permissions/types'

import { subject as tagSubject } from '@casl/ability'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../../types'
import { subjectOf } from '../define-spec'
import { whereFor } from './where'

export interface Permit {
  /** AND this into any query over the spec's table. Always a real SQL value: true, false or a predicate. */
  sql: SQL
  /** Is the row with this primary key within reach? */
  probe: (id: string | number) => Promise<boolean>
  /**
   * Is the row the rules are written against within reach: the entity's own row, or the root parent's
   * row for a sub-entity? Mutation rules only: a rule with an operator cannot be tested on a row.
   */
  test: (row: Record<string, unknown>) => boolean
}

// What the rules are asked about: a sub-entity is a field of its root parent's subject, and its
// writes are the parent's `update` of that field.
function ruleTarget(spec: AnyServerSpec, action: CrudAction, fields: readonly string[] | undefined): { subject: string, verb: CrudAction, paths: string[] } {
  if ('subject' in spec) {
    return { subject: spec.subject, verb: action, paths: [...(fields ?? [])] }
  }
  const path = fieldPathOf(spec)
  return {
    subject: subjectOf(spec),
    verb: action === 'read' ? 'read' : 'update',
    paths: fields?.length ? fields.map(field => `${path}.${field}`) : [path],
  }
}

/** The dotted field a sub-entity is under its root parent: `views`, or `applications.answers` two levels down; empty for an entity. */
export function fieldPathOf(spec: AnyServerSpec): string {
  if ('subject' in spec) {
    return ''
  }
  const above = fieldPathOf(spec.parent.spec)
  return above ? `${above}.${spec.parent.field}` : spec.parent.field
}

// The `as never` casts here and below are the one place run-time strings meet CASL's typed parameters:
// `rulesFor` and `relevantRuleFor` keep CASL's loose signatures on purpose.
function walk(ability: AppAbility, action: CrudAction, subject: string, fields: readonly string[], ctx: { table: PgTable, pk: PgColumn }): SQL {
  if (fields.length === 0) {
    return whereFor(ability, action, subject as never, undefined, ctx)
  }
  const parts = fields.map(field => whereFor(ability, action, subject as never, field, ctx))
  return parts.length === 1 ? parts[0]! : and(...parts)!
}

function through(ability: AppAbility, action: CrudAction, parent: AnyServerSpec, fk: PgColumn, fields: readonly string[] | undefined): SQL {
  return inArray(
    fk,
    db.select({ pk: pkColumnOf(parent) }).from(parent.table as PgTable).where(filterFor(ability, action, parent, fields)),
  )
}

/**
 * An entity reads through its own `read` rules, and through its parent's when it has one; it writes
 * through its own rules for the action AND its read filter. A sub-entity reads through the parent's
 * `read` rules that cover its field, and writes through the parent's `update` rules that cover it,
 * AND that read. A row that cannot be read cannot be changed.
 */
export function filterFor(ability: AppAbility, action: CrudAction, spec: AnyServerSpec, fields: readonly string[] | undefined): SQL {
  const ctx = { table: spec.table as PgTable, pk: pkColumnOf(spec) }
  if ('subject' in spec) {
    const own = walk(ability, action, spec.subject, fields ?? [], ctx)
    const read = action === 'read' ? own : walk(ability, 'read', spec.subject, [], ctx)
    const parent = spec.parent ? through(ability, 'read', spec.parent.spec, spec.parent.fk, undefined) : undefined
    return action === 'read' ? and(read, parent)! : and(own, read, parent)!
  }
  const { spec: parentSpec, fk, field } = spec.parent
  const paths = fields?.length ? fields.map(name => `${field}.${name}`) : [field]
  const read = through(ability, 'read', parentSpec, fk, paths)
  return action === 'read' ? read : and(through(ability, 'update', parentSpec, fk, paths), read)!
}

export function reachFor(ctx: ScopedContext, action: CrudAction, spec: AnyServerSpec, fields?: readonly string[]): Permit {
  const { ability } = ctx.actor
  const where = filterFor(ability, action, spec, fields)
  const pk = pkColumnOf(spec)
  return {
    sql: where,
    probe: async (id) => {
      const [row] = await (ctx.tx ?? db)
        .select({ ok: sql`1` })
        .from(spec.table as PgTable)
        .where(and(eq(pk, id), where))
        .limit(1)
      return row != null
    },
    test: (row) => {
      const { subject, verb, paths } = ruleTarget(spec, action, fields)
      const withOperator = ability.rulesFor(verb, subject as never).find(rule =>
        rule.conditions && Object.keys(rule.conditions).some(key => key.startsWith('$')))
      if (withOperator) {
        throw new Error(`[permit] ${verb} ${subject}: a rule with an operator cannot be tested on a row`)
      }
      const tagged = tagSubject(subject, row)
      const granted = (field?: string) => {
        const rule = ability.relevantRuleFor(verb, tagged as never, field)
        return rule != null && !rule.inverted
      }
      return paths.length === 0 ? granted() : paths.every(granted)
    },
  }
}

/** Forbidden when the actor holds no rule at all for the action on the spec's subject (for a sub-entity: the parent's verb on its field). */
export function assertGranted(ability: AppAbility, action: CrudAction, spec: AnyServerSpec): void {
  const { subject, verb, paths } = ruleTarget(spec, action, undefined)
  const rule = ability.relevantRuleFor(verb, subject as never, paths[0])
  if (rule == null || rule.inverted) {
    throw new ThrowableDalError({ type: 'forbidden' })
  }
}

/** The row the rules are tested on: the entity's own, or the root parent's for a sub-entity, each hop loaded through that parent's read reach. */
export async function rootRowFor(ctx: ScopedContext, spec: AnyServerSpec, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  let current: AnyServerSpec = spec
  let currentRow = row
  while (!('subject' in current)) {
    const { spec: parentSpec, fk } = current.parent
    const parentId = currentRow[columnKeyOf(current.table as PgTable, fk)]
    const [parentRow] = await (ctx.tx ?? db)
      .select()
      .from(parentSpec.table as PgTable)
      .where(and(eq(pkColumnOf(parentSpec), parentId), filterFor(ctx.actor.ability, 'read', parentSpec, undefined)))
      .limit(1)
    if (!parentRow) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    current = parentSpec
    currentRow = parentRow as Record<string, unknown>
  }
  return currentRow
}

export function pkColumnOf(spec: AnyServerSpec): PgColumn {
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const name = spec.primaryKey ?? 'id'
  const column = table[name]
  if (!column) {
    throw new Error(`[permit] '${name}' is not a column of ${spec.entityName}'s table`)
  }
  return column
}

/** The TypeScript key of a column, by identity: `PgColumn.name` is the database-side name. */
export function columnKeyOf(table: PgTable, column: PgColumn): string {
  const key = Object.entries(table as unknown as Record<string, PgColumn>).find(([, candidate]) => candidate === column)?.[0]
  if (!key) {
    throw new Error('[permit] the column is not on the table')
  }
  return key
}
