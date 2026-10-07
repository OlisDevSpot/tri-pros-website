import type { ScopedContext } from '../types'
import type { SystemReason } from '@/shared/domains/permissions/rules/system'

import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { systemRules } from '@/shared/domains/permissions/rules/system'

/** An unrestricted context for jobs, webhooks and server-derived writes. The reason rides on the rule, so every privileged site is named. */
export function systemContext(reason: SystemReason): ScopedContext {
  return { actor: { ability: abilityFromRules(systemRules(reason)), userId: null }, scope: null }
}
