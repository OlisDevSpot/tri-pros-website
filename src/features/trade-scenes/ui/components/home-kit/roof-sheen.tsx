'use client'

import type { CanvasTexture } from 'three'

import { useFrame } from '@react-three/fiber'

import { ROOF_SHEEN } from '@/features/trade-scenes/constants/home-life'
import { createSheenTexture } from '@/features/trade-scenes/ui/lib/create-sheen-texture'
import { roofSheenGeometry } from '@/features/trade-scenes/ui/lib/roof-sheen-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface RoofSheenProps {
  zFrom: number
  zTo: number
  covering: string | null
  running: boolean
}

// One set of streaks for every sheen, drawn on first use because the canvas only exists in the browser. Shared, so every
// slope's streaks move together and the two parts of the near slope stay in step at the cut.
let texture: CanvasTexture | null = null
function sheenTexture(): CanvasTexture {
  texture ??= createSheenTexture()
  return texture
}

// The rain's film on one run of a slope, drawn in the slope's own frame, sliding down it and over the eave. A tap passes
// through it to the roof.
export function RoofSheen({ zFrom, zTo, covering, running }: RoofSheenProps) {
  const rise = ROOF_SHEEN.rise[covering ?? 'default'] ?? ROOF_SHEEN.rise.default
  const geometry = useOwnedGeometry(() => roofSheenGeometry(zFrom, zTo, rise), [zFrom, zTo, rise])

  // Set from the clock rather than stepped, so every sheen reads the same offset however many draw it. three samples at
  // uv + offset, so the offset falls to carry the streaks down the slope, where v rises.
  useFrame((state) => {
    if (running) {
      sheenTexture().offset.y = -((state.clock.elapsedTime * ROOF_SHEEN.speed / ROOF_SHEEN.tile[1]) % 1)
    }
  })

  return (
    <mesh geometry={geometry} raycast={ignoreRaycast}>
      <meshStandardMaterial color={ROOF_SHEEN.color} opacity={ROOF_SHEEN.opacity} alphaMap={sheenTexture()} transparent depthWrite={false} roughness={0.2} />
    </mesh>
  )
}
