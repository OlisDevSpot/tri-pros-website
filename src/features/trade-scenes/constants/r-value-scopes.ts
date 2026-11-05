import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// The upgrades that sell insulation, whose savings claims the FTC R-value Rule governs. Listed by hand: the window glass
// also carries an R-value and the insulate role, and windows fall outside the rule.
export const R_VALUE_SCOPES: readonly ScopeId[] = [
  SCOPE_IDS.atticInsulationReplacement,
  SCOPE_IDS.atticInsulationTopOff,
  SCOPE_IDS.crawlSpaceInsulation,
]
