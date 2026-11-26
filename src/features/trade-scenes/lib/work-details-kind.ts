import type { ScopeInstall } from '@/shared/modules/construction/core/types'

import { MOVABLE_INDOOR_UNIT_SCOPES } from '@/features/trade-scenes/constants/movable-indoor-unit-scopes'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

type Install = ScopeInstall['installs'][number]
export type WorkDetailsKind = 'shingle' | 'membrane' | 'paint' | 'vinyl-frame' | 'gutter' | 'indoor-unit' | 'mini-split'

function kindOf({ part, material }: Install): WorkDetailsKind | null {
  if (part === 'covering' && (material === 'shingle' || material === 'membrane')) {
    return material
  }
  if (part === 'paint') {
    return 'paint'
  }
  if (part === 'gutter') {
    return 'gutter'
  }
  if (part === 'mini-split-heads') {
    return 'mini-split'
  }
  return part === 'frame' && material === 'vinyl-frame' ? 'vinyl-frame' : null
}

// What a pick lays decides what the rep can choose for it; No change, and work with nothing to choose, have no details.
export function workDetailsKind(scopeId: string | null): WorkDetailsKind | null {
  if (scopeId !== null && (MOVABLE_INDOOR_UNIT_SCOPES as readonly string[]).includes(scopeId)) {
    return 'indoor-unit'
  }
  const installs = scopeId === null ? [] : SCOPE_INSTALLS[scopeId]?.installs ?? []
  return installs.map(kindOf).find(kind => kind !== null) ?? null
}

// A whole new system's details hold only the move to the attic, so where its unit cannot move there it has none to show.
export function workDetailsShown(kind: WorkDetailsKind | null, moveToAtticOffered: boolean): kind is WorkDetailsKind {
  return kind !== null && (kind !== 'indoor-unit' || moveToAtticOffered)
}
