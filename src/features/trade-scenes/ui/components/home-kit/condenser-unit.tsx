'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { BoxSpec, DrawnHvac, FurniturePlacement } from '@/features/trade-scenes/types'
import type { SpotHover } from '@/features/trade-scenes/ui/components/home-kit/spot-hover'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useMemo } from 'react'

import { CONDENSER_LINE_SET } from '@/features/trade-scenes/constants/home-details'
import { CONDENSER_PLACEMENT, HEAT_PUMP_PLACEMENT } from '@/features/trade-scenes/constants/home-furnishings'
import { EQUIPMENT, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { CONDENSER_SHIMMER_POSITION } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { CONCRETE_TEXTURE } from '@/features/trade-scenes/constants/material-textures'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { useStrainShake } from '@/features/trade-scenes/hooks/use-strain-shake'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { CondenserFan } from '@/features/trade-scenes/ui/components/home-kit/condenser-fan'
import { FurniturePiece } from '@/features/trade-scenes/ui/components/home-kit/furniture-piece'
import { HeatShimmer } from '@/features/trade-scenes/ui/components/home-kit/heat-shimmer'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface CondenserUnitProps {
  kind: NonNullable<DrawnHvac['outdoor']>['kind']
  /** 0 when it is not running: a winter night's furnace leaves a condenser idle, while a heat pump heats with it. */
  load: number
  // A heat pump heating draws its warmth out of the outdoor air, so no hot haze rises off it.
  heating: boolean
  burst: SceneBurst
  wear: number
  /** The AC size's multiplier on the unit, about its base centre; 1 is the unit as modelled. */
  scale: number
  // A tap on the unit, its pad or its lines asks which systems are there.
  onTap: (event: ThreeEvent<MouseEvent>) => void
  hover: SpotHover
}

const [x, , z] = EQUIPMENT.condenser.position
const [padWidth, padHeight, padDepth] = EQUIPMENT.condenser.pad
const PAD: BoxSpec[] = [{ size: [padWidth, padHeight, padDepth], position: [x, padHeight / 2, z] }]

const { y: LINE_Y, inset, size: LINE, z: lineZ } = CONDENSER_LINE_SET
const LINE_FROM = x + padWidth / 2 - inset
const LINE_SET: BoxSpec[] = [
  { size: [-HOUSE.halfLength - LINE_FROM, LINE, LINE], position: [(LINE_FROM - HOUSE.halfLength) / 2, LINE_Y, z + lineZ] },
  { size: [LINE, LINE_Y - padHeight, LINE], position: [LINE_FROM, (LINE_Y + padHeight) / 2, z + lineZ] },
]

const { position: [px, py, pz], rotationY } = CONDENSER_PLACEMENT
const PLACEMENTS = { 'condenser': CONDENSER_PLACEMENT, 'heat-pump': HEAT_PUMP_PLACEMENT } as const satisfies Record<CondenserUnitProps['kind'], FurniturePlacement>

// The case and grille go the colour of the dust they collect; the fan blades and the trim stay as they are.
function dustyPlacement(placement: FurniturePlacement, wear: number): FurniturePlacement {
  const { colors, standIn } = placement
  const { dust, case: caseShare, grille } = WEAR_LOOKS.condenser
  const dusted = (colour: string, share: number) => wornColor(colour, dust, wear * share)
  return {
    ...placement,
    colors: { ...colors, LightGrey: dusted(colors.LightGrey, caseShare), Grey: dusted(colors.Grey, grille) },
    standIn: { ...standIn, color: dusted(standIn.color, caseShare) },
  }
}

export function CondenserUnit({ kind, load, heating, burst, wear, scale, onTap, hover }: CondenserUnitProps) {
  const shake = useStrainShake(load, burst)
  const placement = useMemo(() => dustyPlacement(PLACEMENTS[kind], wear), [kind, wear])
  return (
    <group onClick={onTap} {...hover}>
      <group userData={thermalTag('exterior')}>
        {/* The pad is set with the unit, so it lights with it. */}
        <group userData={systemPartTag('condenser')}>
          <MergedBoxes boxes={PAD} color={HOME_PALETTE.concrete} texture={CONCRETE_TEXTURE} radius={0.02} receiveShadow />
        </group>
        <group userData={systemPartTag('refrigerant-lines')}>
          <MergedBoxes boxes={LINE_SET} color={HOME_PALETTE.felt} radius={0.02} />
        </group>
      </group>
      {/* It reads above the outside air by its cooling load: idle on a winter night or in the rain, at the air itself. */}
      <group ref={shake} userData={thermalTag('condenser')}>
        <group position={[px, py, pz]} scale={scale} userData={systemPartTag('condenser')}>
          <group position={[-px, -py, -pz]}>
            <FurniturePiece placement={placement} />
            <group position={[px, py, pz]} rotation={[0, rotationY, 0]}>
              <CondenserFan load={load} burst={burst} />
            </group>
          </group>
        </group>
      </group>
      {/* Additive haze dimmed by its own colour: painted solid it would hang over the unit as a hot square. */}
      <group userData={thermalTag(OWN_PAINT)}>
        <HeatShimmer position={CONDENSER_SHIMMER_POSITION} load={heating ? 0 : load} burst={burst} />
      </group>
    </group>
  )
}
