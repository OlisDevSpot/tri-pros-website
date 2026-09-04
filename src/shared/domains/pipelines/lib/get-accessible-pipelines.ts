import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** Pipelines accessible to agents (non-super-admins) */
const AGENT_PIPELINES: readonly Pipeline[] = ['projects', 'fresh']

/**
 * Pipelines accessible to dispatchers — the whole operational pipeline they
 * work: fresh (booked, awaiting/after meeting) plus the cold pool — unworked
 * leads and the negative-outcome buckets they re-engage (rehash = recallable,
 * dead = terminal). NOT 'projects' (converted deals = the agent's book).
 * MUST stay in lockstep with the dispatcher's `$inDerivedPipeline`
 * row-visibility rule in abilities.ts, or the customer-pipelines API guard
 * rejects a tab they can actually see.
 */
const DISPATCHER_PIPELINES: readonly Pipeline[] = ['fresh', 'leads', 'rehash', 'dead']

/**
 * Returns the pipelines a user can access based on their CASL ability.
 * Super-admins see all pipelines. Dispatchers see the operational pipeline
 * (fresh + leads + rehash + dead). Agents see only fresh + projects. Uses the
 * `pipelines` const array to maintain canonical ordering.
 */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  if (ability.can('manage', 'all')) {
    return [...pipelines]
  }
  if (ability.can('read', 'LeadsPool')) {
    return pipelines.filter(p => (DISPATCHER_PIPELINES as readonly string[]).includes(p))
  }
  return pipelines.filter(p => (AGENT_PIPELINES as readonly string[]).includes(p))
}
