import type { SQL } from 'drizzle-orm'

import type { Actor } from './actor'
import type { ScopeNode } from './ast'
import type { OperatorCtx } from './operators'

import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { rulesToAST } from '@casl/ability/extra'
import { sql } from 'drizzle-orm'

import { interpret } from './interpret'

/**
 * Compile an (actor, action, subject) triple into a WHERE fragment (spec §4).
 * Sentinel semantics VERIFIED against @casl/ability@6.8.0 (spec §4.1):
 *   - null       → no constraint (allow-all): system, or a conditionless/omni user rule
 *   - sql`false` → DENY-ALL: the role has NO rule for this subject
 *   - SQL        → the compiled predicate
 * The DAL's `and(eq(pk,id), scope ?? undefined)` then fails SAFE on deny.
 */
export function compileScope(actor: Actor, action: AppAction, subject: AppSubject, ctx: OperatorCtx): SQL | null {
  if (actor.kind === 'system')
    return null // trusted → no constraint
  if (actor.kind === 'token')
    return actor.scope // bearer → exactly its shared row(s)

  const ast = rulesToAST(actor.ability, action, subject)
  if (ast === null)
    return sql`false` // DENY-ALL: no rule for this subject

  // Single boundary cast: CASL's ucast `Condition` → our structural `ScopeNode`
  // (we intentionally don't import @ucast types — see ast.ts). empty-AND → null.
  return interpret(ast as unknown as ScopeNode, ctx) ?? null
}
