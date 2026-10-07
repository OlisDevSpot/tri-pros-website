import type { AnyServerSpec } from '../../types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { subject as tagSubject } from '@casl/ability'

import { subjectOf } from '../define-spec'
import { fieldPathOf } from './core'

/**
 * A `read` rule with a field list limits what the actor receives: the row leaves the DAL with those
 * columns only. A rule without a field list, or `manage all`, admits every column. For a sub-entity
 * the parent's rules decide: `views` or `views.*` admits every column of a view, `views.viewedAt` one.
 * Lowest priority first, each matching rule adding or removing its columns, as CASL's own
 * `permittedFieldsOf` walks. A rule with an operator counts as matching: the SQL filter that loaded
 * the row already applied it, and the in-memory matcher cannot evaluate it.
 */
export function projectToReadFields(ability: AppAbility, spec: AnyServerSpec, row: Record<string, unknown>): Record<string, unknown> {
  // `as never`: the subject is a run-time string, and CASL's typed parameters want the literal union.
  const columns = Object.keys(row)
  const subject = subjectOf(spec)
  const path = fieldPathOf(spec)
  const prefix = path ? `${path}.` : ''
  const tagged = tagSubject(subject, row)
  const permitted = new Set<string>()
  for (const rule of [...ability.possibleRulesFor('read', subject as never)].reverse()) {
    const carriesOperator = rule.conditions != null && Object.keys(rule.conditions).some(key => key.startsWith('$'))
    if (!carriesOperator && !rule.matchesConditions(tagged as never)) {
      continue
    }
    for (const column of rule.fields ? columnsNamedBy(rule.fields, columns, prefix) : columns) {
      if (rule.inverted) {
        permitted.delete(column)
      }
      else {
        permitted.add(column)
      }
    }
  }
  if (columns.every(column => permitted.has(column))) {
    return row
  }
  return Object.fromEntries(columns.filter(column => permitted.has(column)).map(column => [column, row[column]]))
}

function columnsNamedBy(fields: readonly string[], columns: string[], prefix: string): string[] {
  return fields.flatMap((field) => {
    if (!prefix) {
      return columns.includes(field) ? [field] : []
    }
    if (field === prefix.slice(0, -1) || field === `${prefix}*` || field === `${prefix}**`) {
      return columns
    }
    const own = field.startsWith(prefix) ? field.slice(prefix.length) : ''
    return own && columns.includes(own) ? [own] : []
  })
}
