'use client'

import type { WeatherSky } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { Color } from 'three'

import { GROUND_MATERIALS } from '@/features/trade-scenes/constants/ground-materials'
import { GROUND_ROWS } from '@/features/trade-scenes/constants/home-lot'
import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { groundStripGeometry } from '@/features/trade-scenes/ui/lib/ground-strip-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface LotGroundProps {
  ground: WeatherSky['ground']
}

// Wider than the sky dome, so the ground runs out under the fog and never shows an edge.
const HALF_WIDTH = 140

export function LotGround({ ground }: LotGroundProps) {
  // UVs are metres; the texture set decides how many metres one tile covers.
  const geometry = useOwnedGeometry(() => groundStripGeometry(GROUND_ROWS, HALF_WIDTH, 1), [])
  // Until the map arrives the lawn shows today's flat green under the weather's tint.
  const flat = useMemo(() => `#${new Color(GROUND_MATERIALS.sod.look.color).multiply(new Color(ground.color)).getHexString()}`, [ground.color])

  return (
    <mesh geometry={geometry} receiveShadow>
      <TexturedMaterial set="sod-healthy" map="own" color={flat} mapTint={ground.color} roughness={ground.roughness} />
    </mesh>
  )
}
