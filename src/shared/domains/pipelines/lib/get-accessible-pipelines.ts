import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

const AGENT_PIPELINES: readonly Pipeline[] = ['projects', 'fresh']
// The lead buckets the dispatcher works; a customer with a project is never theirs.
const DISPATCHER_PIPELINES: readonly Pipeline[] = ['leads', 'rehash', 'dead', 'fresh']

/**
 * The kanban tabs a role may open, in the canonical `pipelines` order. A hand copy of the Customer
 * read rules until the tabs read the ability directly.
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
