import type { RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

export const SCOPES_BY_EXISTING_ROOF: Record<RoofType, readonly ScopeId[]> = {
  shingle: [SCOPE_IDS.roofOverlay, SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  flat: [SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofRedeck],
  tile: [SCOPE_IDS.roofTileReset, SCOPE_IDS.roofRedeck],
  woodshake: [SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  metal: [],
}

// A new deck can only go on once the old covering is off.
export const ROOF_OFF_SCOPE_IDS: readonly ScopeId[] = [SCOPE_IDS.roofTearOff, SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofTileReset]
