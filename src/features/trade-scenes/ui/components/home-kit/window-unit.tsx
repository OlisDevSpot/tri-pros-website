'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { EQUIPMENT, HOUSE, HOUSE_WALLS } from '@/features/trade-scenes/constants/home-geometry'
import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useHeatGlow } from '@/features/trade-scenes/hooks/use-heat-glow'
import { useStrainShake } from '@/features/trade-scenes/hooks/use-strain-shake'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface WindowUnitProps {
  load: number
  heatLoad: number
  burst: SceneBurst
}

const WINDOW = HOUSE_WALLS.back.openings[0]
const { x, inside } = EQUIPMENT.windowUnit
const [width, height, depth] = EQUIPMENT.windowUnit.size
const INNER_FACE = HOUSE_WALLS.back.line + inside
const Y = HOUSE.floorY + WINDOW.sill + height / 2 + 0.01

const BODY: BoxSpec[] = [{ size: [width, height, depth], position: [x, Y, INNER_FACE - depth / 2] }]
// The room face: louvres over most of it and a small control panel to one side.
const FACE: BoxSpec[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    size: [width * 0.6, 0.016, 0.014] as const,
    position: [x - width * 0.12, Y - height * 0.3 + index * 0.05, INNER_FACE + 0.004] as const,
  })),
  { size: [width * 0.16, height * 0.55, 0.012], position: [x + width * 0.32, Y, INNER_FACE + 0.003] },
]

// A portable unit in the bedroom's back window, above the bed, facing the open front. It rattles with the load it carries,
// and on a winter night its heater glows through the louvres.
export function WindowUnit({ load, heatLoad, burst }: WindowUnitProps) {
  const shake = useStrainShake(load, burst)
  const glow = useHeatGlow(heatLoad)
  return (
    <group ref={shake}>
      <MergedBoxes boxes={BODY} color={HOME_PALETTE.unit} radius={0.03} roughness={0.6} castShadow />
      <MergedBoxes boxes={FACE} color={HOME_PALETTE.unitGrille} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={glow} />
    </group>
  )
}
