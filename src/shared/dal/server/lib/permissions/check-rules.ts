import type { AnyServerSpec } from '../../types'

import type { ScopeNode } from './ast'

import { userRoles } from '@/shared/constants/enums'
import { SERVER_SPECS } from '@/shared/dal/server/specs'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

import { pkColumnOf } from './core'
import { interpret } from './interpret'

/** Every rule's conditions walk through the interpreter at boot, so an unknown key nested inside a condition value fails here, not on a request. */
export function assertRulesCompile(): void {
  const specBySubject = new Map<string, AnyServerSpec>()
  for (const spec of SERVER_SPECS) {
    if ('subject' in spec) {
      specBySubject.set(spec.subject, spec)
    }
  }
  for (const role of userRoles) {
    const ability = defineAbilitiesFor({ id: '00000000-0000-4000-8000-000000000000', role })
    for (const raw of ability.rules) {
      if (!raw.conditions) {
        continue
      }
      for (const action of [raw.action].flat()) {
        for (const subject of [raw.subject].flat()) {
          const spec = specBySubject.get(String(subject))
          if (!spec) {
            throw new Error(`[permit] ${role}: conditions on '${String(subject)}', which has no spec`)
          }
          // CASL builds a rule's `ast` on the rule objects it hands out per action and subject, not on the raw data.
          for (const rule of ability.possibleRulesFor(action, subject)) {
            if (rule.conditions) {
              interpret(rule.ast as ScopeNode, { table: spec.table, pk: pkColumnOf(spec) })
            }
          }
        }
      }
    }
  }
}
