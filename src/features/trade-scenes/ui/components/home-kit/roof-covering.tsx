'use client'

import type { CoveringLook } from '@/features/trade-scenes/lib/covering-look'
import type { CoveringCourseKind, CoveringPiece } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { TILE_WEAR } from '@/features/trade-scenes/constants/covering-wear'
import { COVERING_BASE, COVERING_EAVE_X, HOUSE, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { coveringShares } from '@/features/trade-scenes/lib/covering-look'
import { SHAKE, SHINGLE, TILE } from '@/features/trade-scenes/lib/home-roof-layout'
import { wornValue } from '@/features/trade-scenes/lib/part-state'
import { piecesInSpan } from '@/features/trade-scenes/lib/pieces-in-span'
import { layoutShakes } from '@/features/trade-scenes/lib/shake-layout'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { CoveringCourse } from '@/features/trade-scenes/ui/components/home-kit/covering-course'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface RoofCoveringProps {
  look: CoveringLook
  zFrom: number
  zTo: number
  // Wider than `zFrom..zTo` when another part of the slope lays the same courses on past either end, so no joint shows.
  layout: readonly [number, number]
  seed: number
  // Replaces the covering's new tone, for a shingle the build installs in a picked colour.
  newTone: string | null
}

// The covering laid course by course in the slope's own frame, each kind of piece in one instanced draw.
export function RoofCovering({ look, zFrom, zTo, layout, seed, newTone }: RoofCoveringProps) {
  const { material, wear, reused } = look
  const { cracked, misaligned, broken, missing, curling, split } = look.levels

  // Laid once over the layout's run; a step that moves `zFrom` only takes another span of the same courses.
  const laid = useMemo((): { course: CoveringCourseKind, pieces: CoveringPiece[], trimmed: boolean }[] => {
    const [layoutFrom, layoutTo] = layout
    const shares = coveringShares({ cracked, misaligned, broken, missing, curling, split })
    const area = { seed, wear, shares, reused, xFrom: COVERING_EAVE_X, xTo: SLOPE_LENGTH + COVERING_BASE * Math.tan(HOUSE.pitch), zFrom: layoutFrom, zTo: layoutTo, base: COVERING_BASE }
    if (material === 'tile') {
      const replacementTint = wornColor(COVERING_COLORS.tile.new, COVERING_COLORS.tile.worn, wear * TILE_WEAR.replacementFreshness)
      const { pans, caps } = layoutTiles(area, TILE)
      const tinted = (tiles: CoveringPiece[]) => tiles.map(tile => (tile.replacement ? { ...tile, tint: replacementTint } : tile))
      return [{ course: 'pan', pieces: tinted(pans), trimmed: false }, { course: 'cap', pieces: tinted(caps), trimmed: false }]
    }
    if (material === 'wood-shake') {
      return [{ course: 'shake', pieces: layoutShakes(area, SHAKE), trimmed: true }]
    }
    return [{ course: 'shingle', pieces: layoutShingles(area, SHINGLE), trimmed: true }]
  }, [material, wear, reused, cracked, misaligned, broken, missing, curling, split, layout, seed])
  const courses = useMemo(() => laid.map(({ course, pieces, trimmed }) => ({ course, pieces: piecesInSpan(pieces, zFrom, zTo, trimmed), capacity: pieces.length })), [laid, zFrom, zTo])

  const colours = COVERING_COLORS[material ?? 'shingle'] ?? COVERING_COLORS.shingle
  const color = wornColor(newTone ?? colours.new, colours.worn, wear)
  const tile = material === 'tile'
  const roughness = wornValue(0.8, 0.95, wear)

  return (
    <group userData={BLUEPRINT_OMIT_TAG}>
      {courses.map(({ course, pieces, capacity }) => (
        <CoveringCourse
          key={course}
          course={course}
          pieces={pieces}
          capacity={capacity}
          color={color}
          stretchToWidth={!tile}
          roughness={roughness}
          doubleSided={tile}
        />
      ))}
    </group>
  )
}
