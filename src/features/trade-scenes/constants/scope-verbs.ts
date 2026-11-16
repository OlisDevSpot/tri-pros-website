import type { SCOPES_AND_ADDONS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

export const SCOPE_VERBS = {
  [SCOPE_IDS.roofOverlay]: 'overlay',
  [SCOPE_IDS.roofTorchDown]: 'torchDown',
  [SCOPE_IDS.roofTearOff]: 'tearOff',
  [SCOPE_IDS.roofTileReset]: 'tileReset',
  [SCOPE_IDS.roofRedeck]: 'redeck',
  [SCOPE_IDS.gutters]: 'new',
  [SCOPE_IDS.airSealing]: 'seal',
  [SCOPE_IDS.atticInsulationReplacement]: 'replace',
  [SCOPE_IDS.atticInsulationTopOff]: 'topOff',
  [SCOPE_IDS.radiantBarrier]: 'add',
  [SCOPE_IDS.atticFan]: 'add',
  [SCOPE_IDS.windowReplacement]: 'replace',
  [SCOPE_IDS.coolLifeRepaint]: 'repaint',
  [SCOPE_IDS.waterBasedRepaint]: 'repaint',
  [SCOPE_IDS.splitSystemReplacement]: 'wholeSystem',
  [SCOPE_IDS.acReplacement]: 'acOnly',
  [SCOPE_IDS.furnaceReplacement]: 'furnaceOnly',
  [SCOPE_IDS.splitSystemNewCut]: 'newSystem',
  // One name for both: a home is offered only the one that fits it.
  [SCOPE_IDS.heatPumpReplacement]: 'heatPump',
  [SCOPE_IDS.heatPumpNewCut]: 'heatPump',
  [SCOPE_IDS.packageUnitReplacement]: 'replace',
  [SCOPE_IDS.airDuctsReplacement]: 'replace',
  [SCOPE_IDS.miniSplitInstallation]: 'installed',
  [SCOPE_IDS.miniSplitKit]: 'kit',
  [SCOPE_IDS.crawlSpaceInsulation]: 'add',
} as const satisfies Record<ScopeId, keyof typeof SCOPES_AND_ADDONS_COPY.verbs>
