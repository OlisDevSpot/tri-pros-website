'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'

import { EQUIPMENT, PARTITIONS_X } from '@/features/trade-scenes/constants/home-geometry'
import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useHeatGlow } from '@/features/trade-scenes/hooks/use-heat-glow'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface WallFurnaceProps {
  heatLoad: number
}

const { position: [x, y, z], size: [depth, height, width] } = EQUIPMENT.wallFurnace
// The cabinet's back is on the partition, so its face looks away from it, into the room.
const FACING = Math.sign(x - PARTITIONS_X[0])
const FACE_X = x + FACING * depth / 2

const BODY: BoxSpec[] = [{ size: [depth, height, width], position: [x, y, z] }]
// Working numbers, set by screenshot. The warm air leaves through the louvres across the top; the room's air comes in
// under the burner's sight window at the foot.
const LOUVRES: BoxSpec[] = Array.from({ length: 7 }, (_, index) => ({
  size: [0.014, 0.018, width * 0.78] as const,
  position: [FACE_X + FACING * 0.005, y + height * 0.06 + index * 0.05, z] as const,
}))
const INTAKE: BoxSpec[] = [
  ...Array.from({ length: 3 }, (_, index) => ({
    size: [0.012, 0.014, width * 0.78] as const,
    position: [FACE_X + FACING * 0.004, y - height * 0.4 + index * 0.04, z] as const,
  })),
  { size: [0.01, 0.06, width * 0.22], position: [FACE_X + FACING * 0.003, y - height * 0.16, z] },
]

// A gas furnace standing flat on an interior wall, heat only, with nothing outside. On a winter night its burner glows
// through the louvres the warm air leaves by.
export function WallFurnace({ heatLoad }: WallFurnaceProps) {
  const glow = useHeatGlow(heatLoad)
  return (
    <group>
      <MergedBoxes boxes={BODY} color={HOME_PALETTE.unit} radius={0.02} roughness={0.6} castShadow />
      <MergedBoxes boxes={INTAKE} color={HOME_PALETTE.unitGrille} roughness={0.8} />
      <MergedBoxes boxes={LOUVRES} color={HOME_PALETTE.unitGrille} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={glow} />
    </group>
  )
}
