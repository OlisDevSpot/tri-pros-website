import type { FenceKindId, GroundLayer } from '@/features/trade-scenes/types'
import type { MaterialAccessor } from '@/shared/db/types/materials'
import type { ScopeAccessor } from '@/shared/db/types/scopes'
import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'

export const FENCE_KIND_IDS = ['woodFence', 'vinylFence', 'compositeFence', 'wroughtIron', 'chainLink', 'blockWall', 'lowWall', 'woodGate', 'vinylGate', 'compositeGate', 'ironGate'] as const

export const FENCE_NONE = 0

interface FenceKind {
  label: string
  sets: readonly GroundLayer[]
  family: 'wood' | 'vinyl' | 'composite' | 'iron' | 'chain' | 'block'
  gate: boolean
  look: { color: string }
  catalog?: { scopeAccessor: ScopeAccessor, materialAccessor: MaterialAccessor }
}

const BOTH: readonly GroundLayer[] = ['existing', 'proposed']

export const FENCE_KINDS: Record<FenceKindId, FenceKind> = {
  woodFence: { label: 'Wood fence', sets: BOTH, family: 'wood', gate: false, look: { color: LOT_PALETTE.fenceBoard }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'woodFencing' } },
  vinylFence: { label: 'Vinyl fence', sets: BOTH, family: 'vinyl', gate: false, look: { color: LOT_PALETTE.vinyl }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'vinylFencing' } },
  compositeFence: { label: 'Composite fence', sets: BOTH, family: 'composite', gate: false, look: { color: LOT_PALETTE.compositeBoard }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'compositeFencing' } },
  wroughtIron: { label: 'Wrought iron', sets: BOTH, family: 'iron', gate: false, look: { color: LOT_PALETTE.iron }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'wroughtIronFencing' } },
  chainLink: { label: 'Chain link', sets: ['existing'], family: 'chain', gate: false, look: { color: LOT_PALETTE.chainMesh } },
  blockWall: { label: 'Block wall', sets: BOTH, family: 'block', gate: false, look: { color: HOME_PALETTE.blockWall }, catalog: { scopeAccessor: 'installBlockWall', materialAccessor: 'cmuBlock' } },
  lowWall: { label: 'Low wall', sets: BOTH, family: 'block', gate: false, look: { color: HOME_PALETTE.blockWall }, catalog: { scopeAccessor: 'installBlockWall', materialAccessor: 'cmuBlock' } },
  woodGate: { label: 'Wood gate', sets: BOTH, family: 'wood', gate: true, look: { color: LOT_PALETTE.fenceBoard }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'woodFencing' } },
  vinylGate: { label: 'Vinyl gate', sets: BOTH, family: 'vinyl', gate: true, look: { color: LOT_PALETTE.vinyl }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'vinylFencing' } },
  compositeGate: { label: 'Composite gate', sets: BOTH, family: 'composite', gate: true, look: { color: LOT_PALETTE.compositeBoard }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'compositeFencing' } },
  ironGate: { label: 'Iron gate', sets: BOTH, family: 'iron', gate: true, look: { color: LOT_PALETTE.iron }, catalog: { scopeAccessor: 'installFencingGates', materialAccessor: 'wroughtIronFencing' } },
}

export const FENCE_KINDS_BY_LAYER = {
  existing: FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('existing')),
  proposed: FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('proposed')),
} as const satisfies Record<GroundLayer, readonly FenceKindId[]>

export const FENCE_KIND_INDEX = Object.fromEntries(
  FENCE_KIND_IDS.map((id, i) => [id, i + 1]),
) as Record<FenceKindId, number>
