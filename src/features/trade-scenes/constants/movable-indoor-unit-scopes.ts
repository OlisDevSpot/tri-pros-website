import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// The builds that set a whole new indoor unit, so the crew can stand it somewhere else; a half system keeps the one standing.
export const MOVABLE_INDOOR_UNIT_SCOPES: readonly ScopeId[] = [
  SCOPE_IDS.splitSystemReplacement,
  SCOPE_IDS.heatPumpReplacement,
]
