import type { AppAbility } from '../types'

import { registeredOperatorNames } from './operators'

/**
 * Fail LOUD at startup if any role's rules reference a scope operator that
 * isn't registered (spec §11.4). Walks every ability's built rules and
 * collects the `$`-prefixed condition keys as AUTHORED (e.g.
 * `$participatesViaMeeting`), then checks the STRIPPED form against
 * `registeredOperatorNames()` — the registry holds UNPREFIXED names
 * (`participatesViaMeeting`, `hasNoMeeting`, `inDerivedPipeline`; see
 * operators/meeting-participation.ts + operators/derived-pipeline.ts for why:
 * CASL's `MongoQueryParser` unconditionally strips the leading `$` from every
 * parsed node's `operator`). The error message keeps the original
 * `$`-prefixed spelling so it points straight at the rule as authored.
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
  const registered = new Set(registeredOperatorNames())
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

  const missing = [...referenced].filter(key => !registered.has(key.slice(1)))
  if (missing.length)
    throw new Error(`[scope] rules reference unregistered operators: ${missing.join(', ')}`)
}
