'use client'

import type { WeatherSky } from '@/features/trade-scenes/types'

import { useEffect, useMemo } from 'react'

import { GROUND_ROWS } from '@/features/trade-scenes/constants/home-lot'
import { createLawnTexture } from '@/features/trade-scenes/ui/lib/create-lawn-texture'
import { groundStripGeometry } from '@/features/trade-scenes/ui/lib/ground-strip-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface LotGroundProps {
  ground: WeatherSky['ground']
}

// Wider than the sky dome, so the ground runs out under the fog and never shows an edge.
const HALF_WIDTH = 140
const TILE_METRES = 4

export function LotGround({ ground }: LotGroundProps) {
  const geometry = useOwnedGeometry(() => groundStripGeometry(GROUND_ROWS, HALF_WIDTH, TILE_METRES), [])
  const lawn = useMemo(createLawnTexture, [])
  useEffect(() => () => lawn.dispose(), [lawn])

  // The lawn carries its own green; the weather only tints it, and wets it through the roughness.
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={lawn} color={ground.color} roughness={ground.roughness} />
    </mesh>
  )
}
