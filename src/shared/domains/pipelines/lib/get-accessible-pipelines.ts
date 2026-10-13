import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

const AGENT_PIPELINES: readonly Pipeline[] = ['projects', 'fresh']
// The lead buckets the dispatcher works. The projects pipeline carries project and proposal values.
const DISPATCHER_PIPELINES: readonly Pipeline[] = ['leads', 'rehash', 'dead', 'fresh']

/**
 * The pipelines a role may open, in the canonical `pipelines` order. The server refuses any other
 * pipeline, so this list is the rule and the tabs only mirror it.
 */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  if (ability.can('manage', 'all')) {
    return [...pipelines]
  }
  if (ability.can('read', 'LeadsPool')) {
    return pipelines.filter(p => DISPATCHER_PIPELINES.includes(p))
  }
  return pipelines.filter(p => AGENT_PIPELINES.includes(p))
}
