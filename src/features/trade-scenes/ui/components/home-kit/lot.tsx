'use client'

import type { WeatherSky } from '@/features/trade-scenes/types'

import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { LOT_BOXES } from '@/features/trade-scenes/lib/lot-boxes'
import { LotGround } from '@/features/trade-scenes/ui/components/home-kit/lot-ground'
import { LotPlants } from '@/features/trade-scenes/ui/components/home-kit/lot-plants'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { Neighbours } from '@/features/trade-scenes/ui/components/home-kit/neighbours'

interface LotProps {
  ground: WeatherSky['ground']
}

// A double-tap looks at the spot it lands on: the ground, the paving and the walls take it, and the thin pieces lying on
// them pass it through to what is underneath.
export function Lot({ ground }: LotProps) {
  return (
    <group>
      <group userData={BLUEPRINT_OMIT_TAG}>
        <LotGround ground={ground} />
        <LotPlants />
        <Neighbours />
      </group>
      <MergedBoxes boxes={LOT_BOXES.asphalt} color={LOT_PALETTE.asphalt} roughness={0.95} receiveShadow />
      <MergedBoxes boxes={LOT_BOXES.concrete} color={HOME_PALETTE.path} roughness={0.9} castShadow receiveShadow />
      <MergedBoxes boxes={LOT_BOXES.concreteJoints} color={LOT_PALETTE.joint} roughness={1} ignoreTaps />
      <MergedBoxes boxes={LOT_BOXES.mulch} color={LOT_PALETTE.mulch} roughness={1} receiveShadow ignoreTaps />
      <MergedBoxes boxes={LOT_BOXES.blockWalls} color={HOME_PALETTE.blockWall} radius={0.01} roughness={0.95} castShadow receiveShadow />
      <MergedBoxes boxes={LOT_BOXES.wallCaps} color={LOT_PALETTE.wallCap} roughness={0.9} castShadow receiveShadow />
      <MergedBoxes boxes={LOT_BOXES.fenceBoards} color={LOT_PALETTE.fenceBoard} roughness={0.85} castShadow receiveShadow />
      <MergedBoxes boxes={LOT_BOXES.fenceRails} color={LOT_PALETTE.fenceRail} roughness={0.9} castShadow ignoreTaps />
    </group>
  )
}
