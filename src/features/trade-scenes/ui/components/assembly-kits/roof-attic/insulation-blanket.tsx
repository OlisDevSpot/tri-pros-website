'use client'

import { PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { createBlanketGeometry } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/lib/create-blanket-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface InsulationBlanketProps {
  depth: number
  worn: boolean
  color: string
}

// The rafters' underside over the attic floor at x, less a hand's gap: deep fill thins toward the eaves as it does in a real attic.
function underRafters(x: number): number {
  const { halfSpan, pitch, joistDepth, rafterDepth } = PITCHED_KIT
  return joistDepth + (halfSpan - Math.abs(x)) * Math.tan(pitch) - rafterDepth / Math.cos(pitch) - 0.03
}

// Blown fill under a gable: one lumpy blanket that buries the joists, lumpier and more settled when old.
export function InsulationBlanket({ depth, worn, color }: InsulationBlanketProps) {
  const geometry = useOwnedGeometry(() => createBlanketGeometry({
    width: PITCHED_KIT.halfSpan * 2 - 0.04,
    depth: PITCHED_KIT.depth - 0.01,
    height: depth,
    seed: worn ? 11 : 3,
    lumpiness: worn ? 0.28 : 0.12,
    ceilingAt: underRafters,
  }), [depth, worn])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}
