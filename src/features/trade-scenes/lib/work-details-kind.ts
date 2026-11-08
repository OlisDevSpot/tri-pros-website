import type { ScopeInstall } from '@/shared/modules/construction/core/types'

import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

type Install = ScopeInstall['installs'][number]
export type WorkDetailsKind = 'shingle' | 'membrane' | 'paint' | 'vinyl-frame'

function kindOf({ part, material }: Install): WorkDetailsKind | null {
  if (part === 'covering' && (material === 'shingle' || material === 'membrane')) {
    return material
  }
  if (part === 'paint') {
    return 'paint'
  }
  return part === 'frame' && material === 'vinyl-frame' ? 'vinyl-frame' : null
}

// What a pick lays decides what the rep can choose for it; No change, and work with nothing to choose, have no details.
export function workDetailsKind(scopeId: string | null): WorkDetailsKind | null {
  const installs = scopeId === null ? [] : SCOPE_INSTALLS[scopeId]?.installs ?? []
  return installs.map(kindOf).find(kind => kind !== null) ?? null
}
