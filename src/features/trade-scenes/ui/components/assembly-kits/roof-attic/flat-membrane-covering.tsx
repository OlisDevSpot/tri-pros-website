'use client'

import type { PieceLayout } from '@/shared/components/scene/types'

import { useEffect, useMemo } from 'react'
import { SphereGeometry } from 'three'

import { KIT_BLISTER, KIT_COLORS, KIT_GRIT_REPEAT, LOW_SLOPE_COVERING_BASE, LOW_SLOPE_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { createNoiseTexture } from '@/shared/components/scene/lib/create-noise-texture'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'
import { Slab } from '@/shared/components/scene/ui/slab'

interface FlatMembraneCoveringProps {
  worn: boolean
  cool: boolean
  color: string
}

const { halfSpan, overhang, wall, depth, capSheet, rollWidth, lapBead, flashing } = LOW_SLOPE_KIT
const FRONT = -halfSpan - overhang
const BACK = halfSpan - wall.thickness

// The cap sheet in rolls run along the eave, each lapping the one below with a raised seam, and turned up the parapet's face.
// The granules are a texture on a dark sheet; a cool sheet is white. An old one shows blisters where water has sat.
export function FlatMembraneCovering({ worn, cool, color }: FlatMembraneCoveringProps) {
  const texture = useMemo(() => {
    const grit = createNoiseTexture('grit', color, cool ? 17 : 9)
    grit.repeat.set((BACK - FRONT) * KIT_GRIT_REPEAT, depth * KIT_GRIT_REPEAT)
    return grit
  }, [color, cool])
  useEffect(() => () => texture.dispose(), [texture])

  const blisterGeometry = useOwnedGeometry(() => {
    const dome = new SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(KIT_BLISTER.radius, KIT_BLISTER.height, 1)
    return dome
  }, [])
  const blisters = useMemo((): PieceLayout[] => {
    if (!worn) {
      return []
    }
    const random = seededRandom(31)
    return Array.from({ length: KIT_BLISTER.count }, () => ({
      x: FRONT + 0.2 + random() * (BACK - FRONT - 0.4),
      y: LOW_SLOPE_COVERING_BASE + capSheet,
      z: (random() - 0.5) * (depth - 0.2),
      tilt: 0,
      width: KIT_BLISTER.radius * (0.6 + random() * 0.9),
      shade: 0.85 + random() * 0.25,
    }))
  }, [worn])

  const seams = useMemo(() => {
    const at: number[] = []
    for (let x = FRONT + rollWidth; x < BACK; x += rollWidth) {
      at.push(x)
    }
    return at
  }, [])

  const material = <meshStandardMaterial color="#ffffff" map={texture} roughness={worn ? 1 : 0.85} />
  return (
    <>
      <Slab size={[BACK - FRONT, capSheet, depth]} position={[(FRONT + BACK) / 2, LOW_SLOPE_COVERING_BASE + capSheet / 2, 0]}>{material}</Slab>
      {seams.map(x => (
        <Slab key={x} size={[0.03, lapBead, depth]} position={[x, LOW_SLOPE_COVERING_BASE + capSheet + lapBead / 2, 0]}>{material}</Slab>
      ))}
      <Slab size={[capSheet, flashing, depth]} position={[BACK - capSheet / 2, LOW_SLOPE_COVERING_BASE + flashing / 2, 0]}>{material}</Slab>
      {worn && <InstancedPieces geometry={blisterGeometry} pieces={blisters} color={KIT_COLORS.blister} stretchToWidth roughness={1} />}
    </>
  )
}
