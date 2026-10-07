import type { SQL } from 'drizzle-orm'

import type { ScopeNode } from './ast'

import type { OperatorContext } from './operators'
import type { AppAbility, AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { and, not, or, sql } from 'drizzle-orm'

import { interpret } from './interpret'

/**
 * The rows of `ctx.table` that `action` reaches on `subject`, for one field or for the subject as a
 * whole. The fold is CASL's own `rulesToQuery`, walked per field so a rule with a field list counts
 * only for its fields: newest rule first; a bare `can` ends the walk as allow-all behind the `cannot`s
 * before it; a bare `cannot` ends it with what was collected; no `can` at all is deny-all.
 */
export function whereFor(ability: AppAbility, action: AppAction, subject: AppSubject, field: string | undefined, ctx: OperatorContext): SQL {
  const allowed: SQL[] = []
  const denied: SQL[] = []
  for (const rule of ability.rulesFor(action, subject, field)) {
    if (!rule.conditions) {
      if (rule.inverted) {
        break
      }
      return denied.length > 0 ? and(...denied)! : sql`true`
    }
    const predicate = interpret(rule.ast as ScopeNode, ctx)
    if (rule.inverted) {
      denied.push(not(predicate))
    }
    else {
      allowed.push(predicate)
    }
  }
  if (allowed.length === 0) {
    return sql`false`
  }
  const granted = allowed.length === 1 ? allowed[0]! : or(...allowed)!
  return denied.length > 0 ? and(...denied, granted)! : granted
}
