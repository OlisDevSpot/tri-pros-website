'use client'

import type { BoxSpec, HouseWall, RoomSpan } from '@/features/trade-scenes/types'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { HOUSE, HOUSE_WALLS, PARTITION_DOOR, PARTITIONS_X, ROOMS, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { wallBoxes } from '@/features/trade-scenes/lib/wall-boxes'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { RoomFurnishings } from '@/features/trade-scenes/ui/components/home-kit/room-furnishings'

interface RoomsProps {
  roomLight: number
}

const { halfLength: L, halfDepth: D, wallThickness: T, paintThickness: P, partitionThickness, ceilingThickness, floorThickness, floorY } = HOUSE
const CEILING_Y = WALL_TOP_Y - ceilingThickness
const BACK_INNER = -D + T

// The painted face of an outside wall, inside one room, sharing the wall's window openings.
function paint(wall: HouseWall, from: number, to: number): BoxSpec[] {
  return wallBoxes(wall, { from, to, offset: -(T - P) / 2, thickness: P, bottom: floorY, top: CEILING_Y, floorY })
}

// Each side of a partition takes its own room's paint; the doorway sits toward the back.
function partitionSide(x: number, side: -1 | 1): BoxSpec[] {
  const wall: HouseWall = { run: 'z', line: x, outward: side, from: BACK_INNER, to: D, openings: [PARTITION_DOOR] }
  return wallBoxes(wall, { from: BACK_INNER, to: D, offset: partitionThickness / 4, thickness: partitionThickness / 2, bottom: floorY, top: CEILING_Y, floorY })
}

function floorBox(room: RoomSpan): BoxSpec {
  return { size: [room.to - room.from, floorThickness, D * 2 - T], position: [(room.from + room.to) / 2, floorY - floorThickness / 2, T / 2] }
}

const PAINT: Record<keyof typeof ROOMS, BoxSpec[]> = {
  bedroom: [
    ...paint(HOUSE_WALLS.back, ROOMS.bedroom.from, ROOMS.bedroom.to),
    ...paint(HOUSE_WALLS.left, BACK_INNER, D),
    ...partitionSide(PARTITIONS_X[0], -1),
  ],
  living: [
    ...paint(HOUSE_WALLS.back, ROOMS.living.from, ROOMS.living.to),
    ...partitionSide(PARTITIONS_X[0], 1),
    ...partitionSide(PARTITIONS_X[1], -1),
  ],
  kitchen: [
    ...paint(HOUSE_WALLS.back, ROOMS.kitchen.from, ROOMS.kitchen.to),
    ...paint(HOUSE_WALLS.right, BACK_INNER, D),
    ...partitionSide(PARTITIONS_X[1], 1),
  ],
}

const WOOD_FLOORS = [floorBox(ROOMS.bedroom), floorBox(ROOMS.living)]
const TILE_FLOORS = [floorBox(ROOMS.kitchen)]
const ceilingOver = (from: number, to: number): BoxSpec[] => [{ size: [L * 2 - T * 2, ceilingThickness, to - from], position: [0, CEILING_Y + ceilingThickness / 2, (from + to) / 2] }]
const CEILING = ceilingOver(BACK_INNER, HOUSE.atticFrontZ)
// Partly open cuts the ceiling back; the Complete house carries it on to the front wall.
const COMPLETE_CEILING = ceilingOver(HOUSE.atticFrontZ, D - T)

// A living room, a kitchen and one bedroom, open toward the camera.
export function Rooms({ roomLight }: RoomsProps) {
  return (
    <group userData={thermalTag('interior')}>
      <MergedBoxes boxes={WOOD_FLOORS} color={ROOMS.living.floor} roughness={0.8} />
      <MergedBoxes boxes={TILE_FLOORS} color={ROOMS.kitchen.floor} roughness={0.7} />
      <MergedBoxes boxes={PAINT.bedroom} color={ROOMS.bedroom.paint} radius={0.008} />
      <MergedBoxes boxes={PAINT.living} color={ROOMS.living.paint} radius={0.008} />
      <MergedBoxes boxes={PAINT.kitchen} color={ROOMS.kitchen.paint} radius={0.008} />
      <group userData={thermalTag('ceiling', 'ceiling')}>
        <MergedBoxes boxes={CEILING} color={HOME_PALETTE.ceiling} />
        <group userData={HOME_FADE_TAGS.complete}>
          <MergedBoxes boxes={COMPLETE_CEILING} color={HOME_PALETTE.ceiling} />
        </group>
      </group>
      <RoomFurnishings roomLight={roomLight} />
    </group>
  )
}
