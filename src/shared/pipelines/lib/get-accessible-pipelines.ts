import type { AppAbility } from '@/shared/permissions/types'
import type { Pipeline } from '@/shared/types/enums/pipelines'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** Pipelines accessible to agents (non-super-admins) */
const AGENT_PIPELINES: readonly Pipeline[] = ['projects', 'fresh']

/**
 * Returns the pipelines a user can access based on their CASL ability.
 * Super-admins see all pipelines. Agents see only fresh + projects.
 * Uses the `pipelines` const array to maintain canonical ordering.
 */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  if (ability.can('manage', 'all')) {
    return [...pipelines]
  }
  return pipelines.filter(p => (AGENT_PIPELINES as readonly string[]).includes(p))
}
