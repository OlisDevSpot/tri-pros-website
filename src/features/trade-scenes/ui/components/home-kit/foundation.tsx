'use client'

import type { Ref } from 'react'
import type { Group } from 'three'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, HouseWall, PaintLook, StainBoxes, SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { FOUNDATION, FRONT_STEPS } from '@/features/trade-scenes/constants/home-details'
import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { CRAWL_SKIRT_BOXES, CRAWL_VENT_BOXES, FLOOR_FRAMING, FRONT_CRAWL_SKIRT_BOXES, FRONT_CRAWL_VENT_BOXES, FRONT_DOOR, HOUSE, PIERS } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { FOUNDATION_FRONT_WALL, FOUNDATION_WALLS, RAISED_GROUND_STRETCH } from '@/features/trade-scenes/lib/foundation-walls'
import { peelingMarks, wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { fadeBlotches, splashBand } from '@/features/trade-scenes/lib/stain-boxes'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { CrawlInsulation } from '@/features/trade-scenes/ui/components/home-kit/crawl-insulation'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'

interface FoundationProps {
  // Spans grade to the floor's underside; the kit sets its height and stretch to the foundation's floor.
  ground: Ref<Group>
  // The raised foundation's floor insulation; a part with no material draws no batts.
  floorInsulation: PartState
  // The raised foundation's skirt is painted with the walls, so it wears their paint.
  paint: PaintLook
  thermal: boolean
  // The system up close: the skirt is the walls' skin, so it lights with their picks.
  lit: SystemLit | null
}

const UNDER_FLOOR = HOUSE.floorY - HOUSE.floorThickness
const { halfLength: L, halfDepth: D, wallThickness: T } = HOUSE
const { slabSetback: SLAB_SETBACK } = FOUNDATION
// A working number, tuned by eye: the skirt is under a third of the wall's height, so it carries fewer cracks.
const SKIRT_CRACKS = 3

// The stains and the peeling run out to the skirt's corners, as on the house: the side walls over the back skirt's ends, the
// front wall over the front skirt's, which stretches the house's full length. Each with its seeds for the fade's blotches and
// for the peeling.
const SKIRT_STAIN_WALLS = [
  { wall: FOUNDATION_WALLS.back, seed: 71, peelingSeed: PEELING_SEEDS.foundation.back },
  { wall: { ...FOUNDATION_WALLS.left, from: -D }, seed: 72, peelingSeed: PEELING_SEEDS.foundation.left },
  { wall: { ...FOUNDATION_WALLS.right, from: -D }, seed: 73, peelingSeed: PEELING_SEEDS.foundation.right },
]
const FRONT_SKIRT_STAIN_WALL = { wall: { ...FOUNDATION_FRONT_WALL, from: -L, to: L }, seed: 75, peelingSeed: PEELING_SEEDS.foundation.front }
const sunlit = (wall: HouseWall) => facesSummerSun(wall.run === 'z' ? wall.outward : 0, wall.run === 'x' ? wall.outward : 0)

const SLAB: BoxSpec[] = [{ size: [L * 2 - SLAB_SETBACK * 2, UNDER_FLOOR, D * 2 - SLAB_SETBACK * 2], position: [0, UNDER_FLOOR / 2, 0] }]

const CRAWL_GROUND: BoxSpec[] = [{ size: [L * 2 - T * 2, FOUNDATION.crawlGround.thickness, D * 2 - T * 2], position: [0, FOUNDATION.crawlGround.y, 0] }]

// One column per tread, the top one against the wall, so no two faces of the stair lie in the same plane.
const STEPS: BoxSpec[] = Array.from({ length: FRONT_STEPS.risers }, (_, index) => {
  const height = UNDER_FLOOR * (FRONT_STEPS.risers - index) / FRONT_STEPS.risers
  return {
    size: [FRONT_STEPS.width, height, FRONT_STEPS.tread],
    position: [FRONT_DOOR.along, height / 2, D + FRONT_STEPS.tread * (index + 0.5)],
  }
})

// Both foundations are always mounted; their fades show one. What stands on grade sits in the ground frame and grows or folds
// with the floor; the framing, piers and vents hang under the floor at fixed depths.
export function Foundation({ ground, floorInsulation, paint, thermal, lit }: FoundationProps) {
  const skin = wallSkinLook(lit, paint.color)
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const cracks = useMemo(() => {
    const crack = (wall: HouseWall, seed: number) => [{
      boxes: stuccoCracks({ wall, face: T / 2, floorY: 0, top: UNDER_FLOOR, perWall: SKIRT_CRACKS, seed, share: crackShare, band: [0, UNDER_FLOOR], stretch: RAISED_GROUND_STRETCH }),
      color: WEAR_LOOKS.paint.crackColor,
    }]
    return {
      kept: [...crack(FOUNDATION_WALLS.back, 61), ...crack(FOUNDATION_WALLS.left, 62), ...crack(FOUNDATION_WALLS.right, 63)],
      front: crack(FOUNDATION_FRONT_WALL, 65),
    }
  }, [crackShare])
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  const peeling = useMemo(() => {
    const peel = (walls: readonly { wall: HouseWall, peelingSeed: number }[]) => walls.map(({ wall, peelingSeed }) => wallPeeling(wall, 0, 0, peelingShare, peelingSeed, wall.openings, RAISED_GROUND_STRETCH, UNDER_FLOOR))
    return { kept: peel(SKIRT_STAIN_WALLS), front: peel([FRONT_SKIRT_STAIN_WALL]) }
  }, [peelingShare])
  const marks = useMemo(() => ({
    kept: [...cracks.kept, ...peelingMarks(peeling.kept, skin.peeled)],
    front: [...cracks.front, ...peelingMarks(peeling.front, skin.peeled)],
  }), [cracks, peeling, skin.peeled])
  const stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]
  const fadeShare = wornShare(paint.wear)
  const stains = useMemo(() => {
    const look = WEAR_LOOKS.paint
    const on = (walls: readonly { wall: HouseWall, seed: number }[]): StainBoxes[] => [
      { cell: 'splash', boxes: walls.flatMap(({ wall }) => splashBand(wall, 0, stainShare, wall.openings, RAISED_GROUND_STRETCH)), color: look.splashColor, alpha: Math.min(1, look.splashAlpha * stainShare) },
      { cell: 'blotch', boxes: walls.flatMap(({ wall, seed }) => fadeBlotches(wall, 0, UNDER_FLOOR, fadeShare, seed, sunlit(wall), wall.openings, RAISED_GROUND_STRETCH)), color: look.blotchColor, alpha: Math.min(1, look.blotchAlpha * fadeShare) },
    ]
    return { kept: on(SKIRT_STAIN_WALLS), front: on([FRONT_SKIRT_STAIN_WALL]) }
  }, [stainShare, fadeShare])

  return (
    <group>
      <group ref={ground}>
        <group userData={HOME_FADE_TAGS.slab}>
          <MergedBoxes boxes={SLAB} color={HOME_PALETTE.concrete} radius={0.02} castShadow receiveShadow />
        </group>
        <group userData={HOME_FADE_TAGS.raised}>
          <group userData={skin.tag}>
            <MergedBoxes boxes={CRAWL_SKIRT_BOXES} color={skin.color} radius={0.02} castShadow receiveShadow />
          </group>
          <group userData={skin.finish}>
            <TintedMarks lists={marks.kept} thermal={thermal} />
            <PaintStains lists={stains.kept} thermal={thermal} />
          </group>
          <group userData={thermalTag('crawl')}>
            <MergedBoxes boxes={CRAWL_GROUND} color={HOME_PALETTE.crawlGround} roughness={1} />
          </group>
          <MergedBoxes boxes={STEPS} color={HOME_PALETTE.concrete} radius={0.015} castShadow receiveShadow />
          <group userData={HOME_FADE_TAGS.complete}>
            <group userData={skin.tag}>
              <MergedBoxes boxes={FRONT_CRAWL_SKIRT_BOXES} color={skin.color} radius={0.02} castShadow receiveShadow />
            </group>
            <group userData={skin.finish}>
              <TintedMarks lists={marks.front} thermal={thermal} />
              <PaintStains lists={stains.front} thermal={thermal} />
            </group>
          </group>
        </group>
      </group>
      <group userData={HOME_FADE_TAGS.raised}>
        <MergedBoxes boxes={CRAWL_VENT_BOXES} color={HOME_PALETTE.vent} />
        <group userData={thermalTag('crawl-floor')}>
          <MergedBoxes boxes={FLOOR_FRAMING} color={HOME_PALETTE.lumber} />
          {floorInsulation.material !== null && <CrawlInsulation wear={floorInsulation.wear} />}
        </group>
        <group userData={thermalTag('crawl')}>
          <MergedBoxes boxes={PIERS} color={HOME_PALETTE.concrete} />
        </group>
        <group userData={HOME_FADE_TAGS.complete}>
          <MergedBoxes boxes={FRONT_CRAWL_VENT_BOXES} color={HOME_PALETTE.vent} />
        </group>
      </group>
    </group>
  )
}
