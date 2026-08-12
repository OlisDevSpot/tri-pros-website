import type { AppAbility } from '../types'

import { SCOPE_OPERATOR_NAMES } from './operator-names'

/**
 * Fail LOUD at startup if any role's rules reference a scope operator that
 * isn't declared (spec §11.4). Walks every ability's built rules and
 * collects the `$`-prefixed condition keys as AUTHORED (e.g.
 * `$participatesViaMeeting`), then checks the STRIPPED form against
 * `SCOPE_OPERATOR_NAMES` — the contract holds UNPREFIXED names
 * (`participatesViaMeeting`, `hasNoMeeting`, `inDerivedPipeline`; see
 * operator-names.ts for why: CASL's `MongoQueryParser` unconditionally strips
 * the leading `$` from every parsed node's `operator`). The error message keeps
 * the original `$`-prefixed spelling so it points straight at the rule as
 * authored. Validating against the static contract (not the runtime registry)
 * keeps this module — reachable from client-imported `abilities.ts` — free of
 * the server-only operator impls. The contract↔registry match is asserted
 * separately, server-side, in interpret.ts.
 *
 * Takes already-built abilities as an argument (not `userRoles` +
 * `defineAbilitiesFor` internally) to avoid an import cycle with
 * `abilities.ts`, which imports this module. The caller (Task 4, wired into
 * `abilities.ts`) builds one ability per role and passes them in.
 *
 * The "every EntityName has a spec" half of the exhaustiveness check lands in
 * Phase 3 with the entity registry — this ships only the operator half.
 */
export function assertScopeWiring(abilitiesByRole: AppAbility[]): void {
  const declared = new Set<string>(SCOPE_OPERATOR_NAMES)
  const referenced = new Set<string>()

  for (const ability of abilitiesByRole) {
    for (const rule of ability.rules) {
      const conditions = rule.conditions as Record<string, unknown> | undefined
      if (!conditions)
        continue
      for (const key of Object.keys(conditions)) {
        if (key.startsWith('$'))
          referenced.add(key)
      }
    }
  }

  const missing = [...referenced].filter(key => !declared.has(key.slice(1)))
  if (missing.length)
    throw new Error(`[scope] rules reference undeclared operators: ${missing.join(', ')}`)
}
