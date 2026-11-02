import type { AssemblyKit } from '@/features/trade-scenes/constants/assembly-kits'
import type { HomeAnchorId } from '@/features/trade-scenes/constants/home-anchors'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'

// An anchor zooms only when a kit sits there; a later kit registers itself and its anchor starts to zoom with no home change.
export function assemblyAtAnchor(anchor: HomeAnchorId, kits: Partial<Record<AssemblyId, AssemblyKit>> = ASSEMBLY_KITS): AssemblyId | null {
  return ASSEMBLY_IDS.find(id => kits[id]?.anchor === anchor) ?? null
}
