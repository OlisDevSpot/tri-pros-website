import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// Notion files the two paints as two scopes, so this upgrade picks the scope instead of swapping a material, and a proposal reads the picks as they are.
export const UPGRADE_SCOPES = {
  'cool-paint': { plain: SCOPE_IDS.waterBasedRepaint, upgraded: SCOPE_IDS.coolLifeRepaint },
} as const satisfies Partial<Record<EfficiencyUpgradeId, { plain: ScopeId, upgraded: ScopeId }>>
