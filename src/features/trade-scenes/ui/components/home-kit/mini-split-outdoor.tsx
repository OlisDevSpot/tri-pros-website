'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { BoxSpec } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { MINI_SPLIT_OUTDOOR } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface MiniSplitOutdoorProps {
  running: boolean
  wear: number
  // A tap on the unit asks which systems are there, as the condenser's does.
  onTap: (event: ThreeEvent<MouseEvent>) => void
}

const OUTDOOR_TAG = systemPartTag('mini-split-outdoor')

// The cabinet stands on two rails, its round fan on the face toward the yard, off centre the way a mini-split's sits beside its
// compressor. Working numbers, set by screenshot.
const { position: [x, y, z], size: [depth, height, width] } = MINI_SPLIT_OUTDOOR
const FLOOR = y - height / 2
const RAIL = 0.06
const CABINET_Y = FLOOR + RAIL + (height - RAIL) / 2
const RAILS: BoxSpec[] = [-1, 1].map(end => ({ size: [depth, RAIL, 0.06], position: [x, FLOOR + RAIL / 2, z + end * width * 0.38] }))
const CABINET: BoxSpec[] = [{ size: [depth, height - RAIL, width], position: [x, CABINET_Y, z] }]
const FAN_RADIUS = 0.2
const FAN_POSITION = [x - depth / 2 - 0.006, CABINET_Y, z + width * 0.12] as const
const FAN_ROTATION = [0, 0, Math.PI / 2] as const

// A heat pump: in summer it rejects the house's heat and reads above the outside air with the cooling load; in winter it
// reads as the air round it. Idle, it is only the air round it.
export function MiniSplitOutdoor({ running, wear, onTap }: MiniSplitOutdoorProps) {
  const color = useMemo(() => wornColor(HOME_PALETTE.unit, WEAR_LOOKS.condenser.dust, wear * WEAR_LOOKS.condenser.case), [wear])
  return (
    <group onClick={onTap} userData={thermalTag(running ? 'condenser' : 'exterior')}>
      <group userData={OUTDOOR_TAG}>
        <MergedBoxes boxes={CABINET} color={color} radius={0.02} roughness={0.6} castShadow />
        <MergedBoxes boxes={RAILS} color={HOME_PALETTE.unitGrille} roughness={0.8} />
        <mesh position={FAN_POSITION} rotation={FAN_ROTATION}>
          <cylinderGeometry args={[FAN_RADIUS, FAN_RADIUS, 0.012, 28]} />
          <meshStandardMaterial color={HOME_PALETTE.unitGrille} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
