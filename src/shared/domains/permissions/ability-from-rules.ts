// Client-safe: the browser builds its ability from the rules the server sends, so the two must parse conditions the same way.

import type { PermissionRule, StockAbility } from './types'

import { buildMongoQueryMatcher, createMongoAbility } from '@casl/ability'

import { OPERATOR_NAMES } from './operators'

// Each operator is a document-level instruction keyed by its `$` spelling, which is how a rule writes
// it. CASL's parser strips the `$` from the node it emits, so the registry and the declarations hold
// the bare names.
const conditionsMatcher = buildMongoQueryMatcher(
  Object.fromEntries(OPERATOR_NAMES.map(name => [`$${name}`, { type: 'document' as const }])),
)

/** The one place an ability is built from rules, so the server and the browser match them the same way. */
export function abilityFromRules(rules: PermissionRule[]): StockAbility {
  return createMongoAbility<StockAbility>(rules, { conditionsMatcher })
}
