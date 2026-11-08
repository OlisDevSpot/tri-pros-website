'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, HouseWall, PaintLook, StainBoxes, SystemLit, WallOpening } from '@/features/trade-scenes/types'
import type { GlassLook } from '@/features/trade-scenes/ui/lib/glass-look'
import type { WallSkinSpec } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'
import type { PaintWearLevel } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { WindowFrameColorId } from '@/shared/modules/construction/core/constants/window-frame-colors'

import { useMemo } from 'react'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { FRONT_CORNERS, FRONT_OPENINGS, FRONT_WALL, HOUSE, HOUSE_WALLS, SIDE_SKIN_FROM, WALL_TOP_Y, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { LOOK_INSIDE_WINDOW, LOOK_INSIDE_WINDOW_TAG } from '@/features/trade-scenes/constants/look-inside'
import { PAINT_WEAR_SHARE, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { FRONT_DOOR_BOXES } from '@/features/trade-scenes/lib/front-door-boxes'
import { doorFramePeeling, peelingMarks, wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { FRONT_STAIN_WALL, paintedSurfaceStains, STAIN_WALLS, surfaceStainLists } from '@/features/trade-scenes/lib/painted-surface-stains'
import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { sillDirt, splashBand } from '@/features/trade-scenes/lib/stain-boxes'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { windowBoxes } from '@/features/trade-scenes/lib/window-boxes'
import { FramedWindowFrame } from '@/features/trade-scenes/ui/components/home-kit/framed-window-frame'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { WallSkin } from '@/features/trade-scenes/ui/components/home-kit/wall-skin'
import { WindowPanes } from '@/features/trade-scenes/ui/components/home-kit/window-panes'
import { WindowSeals } from '@/features/trade-scenes/ui/components/home-kit/window-seals'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'
import { windowFrameLook } from '@/features/trade-scenes/ui/lib/window-frame-look'

interface HouseShellProps {
  glazing: PartState
  // The glass as drawn: the window's own, or the build's dark Low-E.
  glass: GlassLook
  frame: PartState
  // The build's vinyl frame takes this colour; a home's own frame ignores it.
  windowFrameColor: WindowFrameColorId
  paint: PaintLook
  // The existing cracks a paint job fills: the Stucco pick shows them patched on the bare base coat.
  patchedCracks: PaintWearLevel
  roofForm: RoofForm
  windowGlow: number
  thermal: boolean
  // The system up close, held while its steps ease shut; windows opens the window its view frames into its system parts.
  lit: SystemLit | null
  // A tap on any window's glass or frame asks which systems are there.
  onWindowTap: (event: ThreeEvent<MouseEvent>) => void
  // A tap on the stucco, its corners or its paint's wear asks which systems are there; the glass and frame take theirs first.
  onWallTap: (event: ThreeEvent<MouseEvent>) => void
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

// A crack's width lies along its wall: across x on a wall that runs in x, across z on one that runs in z.
function widened(wall: HouseWall, { size: [x, y, z], ...placing }: BoxSpec, width: number): BoxSpec {
  return { ...placing, size: wall.run === 'x' ? [width, y, z] : [x, y, width] }
}

// Each wall's cracks at a share of the Worn look, on their own seeds; a patch fills the same crack, wider.
function wallCracks(share: number, patchWidth?: number) {
  const crack = (wall: HouseWall, seed: number, openings = wall.openings) => {
    const boxes = stuccoCracks({ wall, face: HOUSE.wallThickness / 2, floorY: HOUSE.floorY, top: WALL_TOP_Y, perWall: WEAR_LOOKS.paint.crackCount, seed, share, openings })
    return patchWidth === undefined ? boxes : boxes.map(box => widened(wall, box, patchWidth))
  }
  return { sides: WALLS.flatMap((wall, index) => crack(wall, 11 + index)), front: crack(FRONT_WALL, 5, FRONT_OPENINGS) }
}

export function HouseShell({ glazing, glass: glassLook, frame: framePart, windowFrameColor, paint, patchedCracks, roofForm, windowGlow, thermal, lit, onWindowTap, onWallTap }: HouseShellProps) {
  // Unknown glazing draws as single: the common case in the homes we visit, and the one the work changes.
  const double = glazing.material === 'double-pane'
  const frame = WINDOW_FRAMES[double ? 'double' : 'single']
  const opened = lit !== null && lit.system === 'windows' ? lit : null
  const up = opened !== null
  const { frames, outside, inside, glass, front } = useMemo(() => {
    const partsIn = (walls: readonly HouseWall[]) => walls.flatMap(wall => wall.openings.map(opening => ({ opening, ...windowBoxes(wall, opening, frame, HOUSE.floorY, HOUSE.wallThickness) })))
    const windowsIn = (parts: ReturnType<typeof partsIn>) => {
      // Up close the framed window's frame is drawn on its own, so the pull can move it out whole.
      const framed = parts.filter(part => !up || part.opening !== LOOK_INSIDE_WINDOW.opening)
      return {
        frames: framed.flatMap(part => part.frames),
        outside: framed.flatMap(part => part.outside),
        inside: framed.flatMap(part => part.inside),
        glass: parts.flatMap(part => part.glass),
      }
    }
    const frontParts = partsIn([FRONT_WALL])
    return {
      ...windowsIn(partsIn(WALLS)),
      front: {
        ...windowsIn(frontParts),
        // Up close the framed window's glazing is drawn as its system parts instead.
        unframedGlass: frontParts.filter(part => part.opening !== LOOK_INSIDE_WINDOW.opening).flatMap(part => part.glass),
      },
    }
  }, [frame, up])

  const skin = wallSkinLook(lit, paint.color)
  const frameLook = windowFrameLook(framePart, double, windowFrameColor)
  const twoTone = frameLook.outside !== frameLook.inside
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]
  const fadeShare = wornShare(paint.wear)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  // Each kind is placed on its own level, so a change to one leaves the others' placing alone.
  const cracks = useMemo(() => wallCracks(crackShare), [crackShare])
  const patchShare = skin.bare ? PAINT_WEAR_SHARE[patchedCracks] : 0
  const patches = useMemo(() => wallCracks(patchShare, WEAR_LOOKS.paint.patch.width), [patchShare])
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
    const { crackColor, sillDirt: dirtColor, peeling: look, patch } = WEAR_LOOKS.paint
    return {
      sides: [{ boxes: cracks.sides, color: crackColor }, { boxes: patches.sides, color: patch.color }, { boxes: dirt.sides, color: dirtColor }, ...peelingMarks(peeling.sides, skin.peeled)],
      front: [
        { boxes: cracks.front, color: crackColor },
        { boxes: patches.front, color: patch.color },
        { boxes: dirt.front, color: dirtColor },
        ...peelingMarks([peeling.front], skin.peeled),
      ],
      // The door frame is trim, so its peeling lights and dims with the frame rather than with the wall's marks.
      door: peelingMarks([peeling.door], look.bareWood),
    }
  }, [cracks, patches, dirt, peeling, skin.peeled])
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
      <group onClick={onWallTap}>
        <group userData={skin.tag}>
          <group userData={thermalTag('sunlit')}>
            <WallSkin skins={SUNLIT_STUCCO} color={skin.color} castShadow receiveShadow />
          </group>
          <WallSkin skins={SHADED_STUCCO} color={skin.color} castShadow receiveShadow />
        </group>
        {/* The damage is the finish's story: it stays lit on the bare wall, and dims under a Paint pick. */}
        <group userData={skin.finish}>
          <TintedMarks lists={marks.sides} thermal={thermal} />
          <PaintStains lists={stains.sides} thermal={thermal} />
        </group>
      </group>
      {/* On a raised home the wall's foot stands on the painted skirt, which carries the band at grade instead. */}
      <group userData={HOME_FADE_TAGS.slab}>
        <group userData={skin.finish}>
          <PaintStains lists={stains.sidesSplash} thermal={thermal} />
        </group>
      </group>
      <group onClick={onWindowTap} userData={systemPartTag('frame')}>
        {twoTone
          ? (
              <>
                <MergedBoxes boxes={outside} color={frameLook.outside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />
                <MergedBoxes boxes={inside} color={frameLook.inside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />
              </>
            )
          : <MergedBoxes boxes={frames} color={frameLook.outside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />}
      </group>
      <group userData={thermalTag('window')}>
        <group onClick={onWindowTap} userData={systemPartTag('glazing')}>
          <MergedBoxes boxes={glass} color={glassLook.color} roughness={glassLook.roughness} opacity={glassLook.opacity} emissive={HOME_PALETTE.glassGlow} emissiveIntensity={windowGlow} />
        </group>
      </group>
      <group userData={HOME_FADE_TAGS.complete}>
        <group onClick={onWallTap}>
          <group userData={skin.tag}>
            <group userData={thermalTag('sunlit')}>
              <MergedBoxes boxes={SUNLIT_CORNERS} color={skin.color} castShadow receiveShadow />
            </group>
            <MergedBoxes boxes={SHADED_CORNERS} color={skin.color} castShadow receiveShadow />
            <group userData={thermalTag(FRONT_ZONE)}>
              <WallSkin skins={FRONT_STUCCO} color={skin.color} castShadow receiveShadow />
            </group>
          </group>
          {/* The door is no painted surface, so it takes the ghost with the rest of what the paint never coats. */}
          <group userData={thermalTag(FRONT_ZONE)}>
            <MergedBoxes boxes={FRONT_DOOR_BOXES.leaf} color={HOME_PALETTE.door} radius={0.008} roughness={0.6} castShadow />
          </group>
          <group userData={systemPartTag('eaves-trim')}>
            <MergedBoxes boxes={FRONT_DOOR_BOXES.frame} color={paint.trim} radius={0.01} roughness={0.7} />
            <TintedMarks lists={marks.door} thermal={thermal} />
          </group>
          <group userData={skin.finish}>
            <TintedMarks lists={marks.front} thermal={thermal} />
            <PaintStains lists={stains.front} thermal={thermal} />
          </group>
        </group>
        <group userData={HOME_FADE_TAGS.slab}>
          <group userData={skin.finish}>
            <PaintStains lists={stains.frontSplash} thermal={thermal} />
          </group>
        </group>
        <group onClick={onWindowTap} userData={systemPartTag('frame')}>
          {twoTone
            ? (
                <>
                  <MergedBoxes boxes={front.outside} color={frameLook.outside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />
                  <MergedBoxes boxes={front.inside} color={frameLook.inside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />
                </>
              )
            : <MergedBoxes boxes={front.frames} color={frameLook.outside} radius={0.01} roughness={frameLook.roughness} metalness={frameLook.metalness} />}
        </group>
        {opened !== null && (
          <group onClick={onWindowTap} userData={systemPartTag('frame', LOOK_INSIDE_WINDOW_TAG)}>
            <FramedWindowFrame frame={frame} frameLook={frameLook} lit={opened} />
            <WindowSeals frame={framePart} size={frame} lit={opened} />
          </group>
        )}
        <group userData={thermalTag('window')}>
          <group onClick={onWindowTap} userData={systemPartTag('glazing')}>
            <MergedBoxes boxes={opened === null ? front.glass : front.unframedGlass} color={glassLook.color} roughness={glassLook.roughness} opacity={glassLook.opacity} emissive={HOME_PALETTE.glassGlow} emissiveIntensity={windowGlow} />
            {opened !== null && <WindowPanes glass={glassLook} frame={frame} lit={opened} glow={windowGlow} />}
          </group>
        </group>
      </group>
    </group>
  )
}
