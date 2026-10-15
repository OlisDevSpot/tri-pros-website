import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** The pipelines the rules open to this ability, in the canonical order. The server refuses any other. */
export function getAccessiblePipelines(ability: AppAbility): Pipeline[] {
  return pipelines.filter(pipeline => ability.can('read', 'CustomerPipeline', pipeline))
}
