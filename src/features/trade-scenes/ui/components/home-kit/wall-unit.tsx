'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { EQUIPMENT, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useHeatGlow } from '@/features/trade-scenes/hooks/use-heat-glow'
import { useStrainShake } from '@/features/trade-scenes/hooks/use-strain-shake'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface WallUnitProps {
  load: number
  heatLoad: number
  burst: SceneBurst
}

const { x, y, size: [width, height, depth], outside } = EQUIPMENT.wallUnit
const OUTER_FACE = -HOUSE.halfDepth - outside
const INNER_FACE = OUTER_FACE + depth

const BODY: BoxSpec[] = [{ size: [width, height, depth], position: [x, y, OUTER_FACE + depth / 2] }]
// Louvres across the lower half of the room face, where the air comes out, and a control strip above them.
const LOUVRES: BoxSpec[] = [
  ...Array.from({ length: 4 }, (_, index) => ({
    size: [width * 0.8, 0.016, 0.016] as const,
    position: [x, y - height * 0.32 + index * 0.045, INNER_FACE + 0.004] as const,
  })),
  { size: [width * 0.3, 0.035, 0.01], position: [x + width * 0.22, y + height * 0.28, INNER_FACE + 0.003] },
]

// A through-the-wall unit beside the bed, its face toward the open front. It rattles with the load it carries, and on a
// winter night its heating element glows through the louvres.
export function WallUnit({ load, heatLoad, burst }: WallUnitProps) {
  const shake = useStrainShake(load, burst)
  const glow = useHeatGlow(heatLoad)
  return (
    <group ref={shake}>
      <MergedBoxes boxes={BODY} color={HOME_PALETTE.unit} radius={0.03} roughness={0.6} castShadow />
      <MergedBoxes boxes={LOUVRES} color={HOME_PALETTE.unitGrille} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={glow} />
    </group>
  )
}
