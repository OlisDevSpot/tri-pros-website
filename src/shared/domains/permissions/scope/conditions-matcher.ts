import type { ConditionsMatcher } from '@casl/ability'

import type { AppConditions } from '@/shared/domains/permissions/types'

import { buildMongoQueryMatcher } from '@casl/ability'

import { SCOPE_OPERATOR_NAMES } from './operator-names'

/**
 * A CASL conditionsMatcher that teaches `rulesToAST` our document operators.
 * - Each scope operator becomes a `{ type: 'document' }` parsing instruction,
 *   so `{ $op: value }` at the top of a rule's conditions parses to a
 *   DocumentCondition whose `value` is the raw payload.
 * - Names come from the static `SCOPE_OPERATOR_NAMES` contract, NOT the runtime
 *   registry. ⚠️ This is a client-bundle boundary: `abilities.ts` (which this
 *   feeds) is imported by client components, and reading names off the registry
 *   would require side-effect-importing `operators/*.ts`, whose `toSql` bodies
 *   pull in `db` → `pg` → `fs` and break the browser build. The impl modules
 *   are loaded server-side only, via interpret.ts. See operator-names.ts.
 * - Instruction keys are `$`-prefixed (`$participatesViaMeeting`) because that
 *   MUST match the literal key used in `can()` conditions — ucast looks up the
 *   instruction by the query object's own key, unchanged.
 * - We do NOT pass an `operatorToConditionName` option. It looks like the
 *   knob that should preserve the leading `$` on the emitted node's
 *   `operator` (per `@ucast/core`'s `ObjectQueryParser`), but @casl/ability's
 *   `buildMongoQueryMatcher` routes through `@ucast/mongo`'s `MongoQueryParser`,
 *   whose constructor hardcodes `operatorToConditionName: e => e.slice(1)` and
 *   never reads the option forwarded here — empirically confirmed against the
 *   installed @casl/ability@6.8.0 / @ucast/mongo@2.4.3 (a probe script parsing
 *   `{ $participatesViaMeeting: {...} }` with `operatorToConditionName: op =>
 *   op` still yielded `operator: 'participatesViaMeeting'`, no `$`). So the
 *   `$` is unconditionally stripped — same as the built-in operators
 *   (`$eq`→`eq`), which is exactly what `interpretField` already assumes.
 *   `SCOPE_OPERATOR_NAMES` therefore holds UNPREFIXED names (see
 *   operator-names.ts), and we re-add the `$` only for the instruction-key
 *   side of this map.
 * We supply NO custom interpreters (2nd arg): on the server the matcher fn is
 * never invoked — only `.ast` is read by rulesToAST. The Client Mirror (toJS)
 * lands later via the same operator registration, not here.
 */
export function buildScopeConditionsMatcher(): ConditionsMatcher<AppConditions> {
  const instructions = Object.fromEntries(
    SCOPE_OPERATOR_NAMES.map(name => [`$${name}`, { type: 'document' as const }]),
  )
  // Boundary cast: ucast's instruction/matcher generics (keyed off `MongoQuery`)
  // don't line up structurally with our narrower `AppConditions` union — same
  // posture as compile-scope.ts's documented `as unknown as ScopeNode` cast.
  return buildMongoQueryMatcher(instructions) as unknown as ConditionsMatcher<AppConditions>
}
