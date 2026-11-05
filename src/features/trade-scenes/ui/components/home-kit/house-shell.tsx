'use client'

import type { HouseWall, PaintLook, StainBoxes, WallOpening } from '@/features/trade-scenes/types'
import type { WallSkinSpec } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'
import type { WindowsType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { useMemo } from 'react'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { FRONT_CORNERS, FRONT_OPENINGS, FRONT_WALL, HOUSE, HOUSE_WALLS, SIDE_SKIN_FROM, WALL_TOP_Y, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { FRONT_DOOR_BOXES } from '@/features/trade-scenes/lib/front-door-boxes'
import { doorFramePeeling, peelingMarks, wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { FRONT_STAIN_WALL, paintedSurfaceStains, STAIN_WALLS, surfaceStainLists } from '@/features/trade-scenes/lib/painted-surface-stains'
import { wornShare, wornValue } from '@/features/trade-scenes/lib/part-state'
import { sillDirt, splashBand } from '@/features/trade-scenes/lib/stain-boxes'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { windowBoxes } from '@/features/trade-scenes/lib/window-boxes'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintMarks } from '@/features/trade-scenes/ui/components/home-kit/paint-marks'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { WallSkin } from '@/features/trade-scenes/ui/components/home-kit/wall-skin'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface HouseShellProps {
  windowsType: WindowsType | null
  frameWear: number
  glassWear: number
  paint: PaintLook
  roofForm: RoofForm
  windowGlow: number
  thermal: boolean
}

const WALLS = Object.values(HOUSE_WALLS)
const SUNLIT_WALLS = WALLS.filter(wall => facesSummerSun(wall.run === 'z' ? wall.outward : 0, wall.run === 'x' ? wall.outward : 0))
const SHADED_WALLS = WALLS.filter(wall => !SUNLIT_WALLS.includes(wall))
const STUCCO_THICKNESS = HOUSE.wallThickness - HOUSE.paintThickness

const STUCCO_BOTTOM = HOUSE.floorY - HOUSE.floorThickness

// The stucco skin of the back and side walls; Partly open leaves the front wall off so the rooms open toward the camera like
// a dollhouse. It stops at the floor's underside on either foundation, and the slab edge or the vented skirt shows below it.
function stuccoSkins(walls: readonly HouseWall[]): WallSkinSpec[] {
  return walls.map(wall => ({
    wall,
    slice: {
      from: wall.run === 'z' ? SIDE_SKIN_FROM : wall.from,
      to: wall.to,
      offset: HOUSE.paintThickness / 2,
      thickness: STUCCO_THICKNESS,
      bottom: STUCCO_BOTTOM,
      top: WALL_TOP_Y,
      floorY: HOUSE.floorY,
    },
  }))
}

// Split by the summer sun, so the thermal camera can warm the walls the afternoon light falls on.
const SUNLIT_STUCCO = stuccoSkins(SUNLIT_WALLS)
const SHADED_STUCCO = stuccoSkins(SHADED_WALLS)
// Each front corner reads as its side wall does.
const cornersOf = (walls: readonly HouseWall[]) => FRONT_CORNERS.filter(box => walls.some(wall => wall.run === 'z' && Math.sign(wall.line) === Math.sign(box.position[0])))
const SUNLIT_CORNERS = cornersOf(SUNLIT_WALLS)
const SHADED_CORNERS = cornersOf(SHADED_WALLS)

// Drawn full thickness in stucco with no room paint on its inside face: the inside only shows through the glass.
const FRONT_STUCCO: WallSkinSpec[] = [{
  wall: FRONT_WALL,
  slice: { from: FRONT_WALL.from, to: FRONT_WALL.to, offset: 0, thickness: HOUSE.wallThickness, bottom: STUCCO_BOTTOM, top: WALL_TOP_Y, floorY: HOUSE.floorY },
  openings: FRONT_OPENINGS,
}]
const FRONT_ZONE = facesSummerSun(0, FRONT_WALL.outward) ? 'sunlit' : null

export function HouseShell({ windowsType, frameWear, glassWear, paint, roofForm, windowGlow, thermal }: HouseShellProps) {
  // Unknown glazing draws as single: the common case in the homes we visit, and the one the work changes.
  const frame = WINDOW_FRAMES[windowsType ?? 'single']
  const { frames, glass, front } = useMemo(() => {
    const windowsIn = (walls: readonly HouseWall[]) => {
      const parts = walls.flatMap(wall => wall.openings.map(opening => windowBoxes(wall, opening, frame, HOUSE.floorY, HOUSE.wallThickness)))
      return { frames: parts.flatMap(part => part.frames), glass: parts.flatMap(part => part.glass) }
    }
    return { ...windowsIn(WALLS), front: windowsIn([FRONT_WALL]) }
  }, [frame])

  const stucco = paint.color
  const trim = wornColor(HOME_PALETTE.trim, WEAR_LOOKS.window.frame, frameWear)
  const glassColor = wornColor(HOME_PALETTE.glass, WEAR_LOOKS.window.glass, glassWear)
  const glassRoughness = wornValue(0.08, WEAR_LOOKS.window.glassRoughness, glassWear)
  const glassOpacity = Math.min(0.85, wornValue(0.4, WEAR_LOOKS.window.glassOpacity, glassWear))
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]
  const fadeShare = wornShare(paint.wear)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  // Each kind is placed on its own level, so a change to one leaves the others' placing alone.
  const cracks = useMemo(() => {
    const crack = (wall: HouseWall, seed: number, openings = wall.openings) => stuccoCracks({ wall, face: HOUSE.wallThickness / 2, floorY: HOUSE.floorY, top: WALL_TOP_Y, perWall: WEAR_LOOKS.paint.crackCount, seed, share: crackShare, openings })
    return { sides: WALLS.flatMap((wall, index) => crack(wall, 11 + index)), front: crack(FRONT_WALL, 5, FRONT_OPENINGS) }
  }, [crackShare])
  // The sills' dirt is the same at every level but None.
  const dirty = stainShare > 0
  const dirt = useMemo(() => {
    const on = (walls: readonly HouseWall[]) => walls.flatMap(wall => sillDirt(wall, HOUSE.floorY, HOUSE.wallThickness, dirty ? 1 : 0))
    return { sides: on(WALLS), front: on([FRONT_WALL]) }
  }, [dirty])
  const peeling = useMemo(() => ({
    sides: STAIN_WALLS.map(({ side, wall }) => wallPeeling(wall, HOUSE.floorY, STUCCO_BOTTOM, peelingShare, PEELING_SEEDS.house[side])),
    front: wallPeeling(FRONT_STAIN_WALL, HOUSE.floorY, STUCCO_BOTTOM, peelingShare, PEELING_SEEDS.house.front, FRONT_OPENINGS),
    door: doorFramePeeling(peelingShare, PEELING_SEEDS.door),
  }), [peelingShare])
  const marks = useMemo(() => {
    const { crackColor, sillDirt: dirtColor, peeling: look } = WEAR_LOOKS.paint
    return {
      sides: [{ boxes: cracks.sides, color: crackColor }, { boxes: dirt.sides, color: dirtColor }, ...peelingMarks(peeling.sides, look.bareStucco)],
      // The door frame stands in the front wall's fade group, so its peeling joins the wall's one draw.
      front: [
        { boxes: cracks.front, color: crackColor },
        { boxes: dirt.front, color: dirtColor },
        ...peelingMarks([peeling.front], look.bareStucco),
        ...peelingMarks([peeling.door], look.bareWood),
      ],
    }
  }, [cracks, dirt, peeling])
  const stains = useMemo(() => {
    const look = WEAR_LOOKS.paint
    const splash = (walls: readonly HouseWall[], openings?: readonly WallOpening[]): StainBoxes[] => [
      { cell: 'splash', boxes: walls.flatMap(wall => splashBand(wall, STUCCO_BOTTOM, stainShare, openings ?? wall.openings)), color: look.splashColor, alpha: Math.min(1, look.splashAlpha * stainShare) },
    ]
    const { sides, front } = paintedSurfaceStains(roofForm, stainShare, fadeShare).walls
    return {
      sides: surfaceStainLists(sides, stainShare, fadeShare),
      front: surfaceStainLists(front, stainShare, fadeShare),
      sidesSplash: splash(STAIN_WALLS.map(({ wall }) => wall)),
      frontSplash: splash([FRONT_STAIN_WALL], FRONT_OPENINGS),
    }
  }, [roofForm, stainShare, fadeShare])

  return (
    <group>
      <group userData={thermalTag('sunlit')}>
        <WallSkin skins={SUNLIT_STUCCO} color={stucco} castShadow receiveShadow />
      </group>
      <WallSkin skins={SHADED_STUCCO} color={stucco} castShadow receiveShadow />
      <PaintMarks lists={marks.sides} thermal={thermal} />
      <PaintStains lists={stains.sides} thermal={thermal} />
      {/* On a raised home the wall's foot stands on the painted skirt, which carries the band at grade instead. */}
      <group userData={HOME_FADE_TAGS.slab}>
        <PaintStains lists={stains.sidesSplash} thermal={thermal} />
      </group>
      <group userData={systemPartTag('frame')}>
        <MergedBoxes boxes={frames} color={trim} radius={0.01} roughness={0.7} />
      </group>
      <group userData={thermalTag('window')}>
        <group userData={systemPartTag('glazing')}>
          <MergedBoxes boxes={glass} color={glassColor} roughness={glassRoughness} opacity={glassOpacity} emissive={HOME_PALETTE.glassGlow} emissiveIntensity={windowGlow} />
        </group>
      </group>
      <group userData={HOME_FADE_TAGS.complete}>
        <group userData={thermalTag('sunlit')}>
          <MergedBoxes boxes={SUNLIT_CORNERS} color={stucco} castShadow receiveShadow />
        </group>
        <MergedBoxes boxes={SHADED_CORNERS} color={stucco} castShadow receiveShadow />
        <group userData={thermalTag(FRONT_ZONE)}>
          <WallSkin skins={FRONT_STUCCO} color={stucco} castShadow receiveShadow />
          <MergedBoxes boxes={FRONT_DOOR_BOXES.leaf} color={HOME_PALETTE.door} radius={0.008} roughness={0.6} castShadow />
        </group>
        <MergedBoxes boxes={FRONT_DOOR_BOXES.frame} color={HOME_PALETTE.trim} radius={0.01} roughness={0.7} />
        <PaintMarks lists={marks.front} thermal={thermal} />
        <PaintStains lists={stains.front} thermal={thermal} />
        <group userData={HOME_FADE_TAGS.slab}>
          <PaintStains lists={stains.frontSplash} thermal={thermal} />
        </group>
        <group userData={systemPartTag('frame')}>
          <MergedBoxes boxes={front.frames} color={trim} radius={0.01} roughness={0.7} />
        </group>
        <group userData={thermalTag('window')}>
          <group userData={systemPartTag('glazing')}>
            <MergedBoxes boxes={front.glass} color={glassColor} roughness={glassRoughness} opacity={glassOpacity} emissive={HOME_PALETTE.glassGlow} emissiveIntensity={windowGlow} />
          </group>
        </group>
      </group>
    </group>
  )
}
