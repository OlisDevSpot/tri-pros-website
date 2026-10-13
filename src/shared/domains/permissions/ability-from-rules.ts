// Client-safe: the browser builds its ability from the rules the server sends, so the two must parse conditions the same way.

import type { PermissionRule, StockAbility } from './types'

import { buildMongoQueryMatcher, createMongoAbility } from '@casl/ability'

import { OPERATOR_NAMES } from './operators'

// An operator is evaluated only in SQL: a rule carrying one cannot be tested on a row, in the browser
// or on the server, and an attempt is a defect rather than a yes or a no.
const interpreters = Object.fromEntries(OPERATOR_NAMES.map(name => [name, (): never => {
  throw new Error(`[rules] '$${name}' is decided by the SQL filter; a rule carrying it cannot be tested on a row`)
}]))

// Each operator is a document-level instruction keyed by its `$` spelling, which is how a rule writes
// it. CASL's parser strips the `$` from the node it emits, so the registry and the declarations hold
// the bare names.
const conditionsMatcher = buildMongoQueryMatcher(
  Object.fromEntries(OPERATOR_NAMES.map(name => [`$${name}`, { type: 'document' as const }])),
  interpreters,
)

/** The one place an ability is built from rules, so the server and the browser match them the same way. */
export function abilityFromRules(rules: PermissionRule[]): StockAbility {
  return createMongoAbility<StockAbility>(rules, { conditionsMatcher })
}
