'use client'

import type { SurfaceTexture } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE } from '@/features/trade-scenes/constants/home-lot'
import { garageGableApexY } from '@/features/trade-scenes/lib/garage-boxes'
import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { gableEndGeometry } from '@/features/trade-scenes/ui/lib/gable-end-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface GarageGableEndProps {
  color: string
  texture?: SurfaceTexture
}

const HALF_DEPTH = (GARAGE.z1 - GARAGE.z0) / 2
const CENTER_Z = (GARAGE.z0 + GARAGE.z1) / 2

// Only the outer end: the inner one stands against the house's own gable.
export function GarageGableEnd({ color, texture }: GarageGableEndProps) {
  const geometry = useOwnedGeometry(() => gableEndGeometry(HALF_DEPTH, GARAGE.wallTop, GARAGE.wallTop + HOUSE.heel, garageGableApexY, HOUSE.wallThickness), [])
  return (
    <mesh geometry={geometry} position={[GARAGE.x1 - HOUSE.wallThickness, 0, CENTER_Z]} castShadow receiveShadow>
      {texture ? <TexturedMaterial {...texture} color={color} roughness={0.95} /> : <meshStandardMaterial color={color} roughness={0.95} />}
    </mesh>
  )
}
