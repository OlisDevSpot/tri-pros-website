'use client'

import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry } from 'three'

import { COVERING_BASE, COVERING_EAVE_X, HOUSE, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { SHAKE, SHINGLE, TILE } from '@/features/trade-scenes/lib/home-roof-layout'
import { wornValue } from '@/features/trade-scenes/lib/part-state'
import { piecesInSpan } from '@/features/trade-scenes/lib/pieces-in-span'
import { layoutShakes } from '@/features/trade-scenes/lib/shake-layout'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

interface RoofCoveringProps {
  material: string | null
  wear: number
  zFrom: number
  zTo: number
  // Wider than `zFrom..zTo` when another part of the slope lays the same courses on past either end, so no joint shows.
  layout: readonly [number, number]
  seed: number
  // Replaces the covering's new tone, for a shingle the build installs in a picked colour.
  newTone: string | null
}

type Course = 'shingle' | 'shake' | 'pan' | 'cap'

// A half-pipe whose axis runs down the slope; `upper` picks the cap's arc over the pan's.
function halfPipe(upper: boolean): CylinderGeometry {
  const geometry = new CylinderGeometry(TILE.radius, TILE.radius, TILE.length, 12, 1, true, upper ? 0 : Math.PI, Math.PI)
  geometry.rotateZ(Math.PI / 2)
  return geometry
}

// The covering laid course by course in the slope's own frame, each kind of piece in one instanced draw.
export function RoofCovering({ material, wear, zFrom, zTo, layout, seed, newTone }: RoofCoveringProps) {
  const geometries: Record<Course, BoxGeometry | CylinderGeometry> = {
    shingle: useOwnedGeometry(() => new BoxGeometry(SHINGLE.length, SHINGLE.thickness, 1), []),
    shake: useOwnedGeometry(() => new BoxGeometry(SHAKE.length, SHAKE.thickness, 1), []),
    pan: useOwnedGeometry(() => halfPipe(false), []),
    cap: useOwnedGeometry(() => halfPipe(true), []),
  }

  const courses = useMemo((): { course: Course, pieces: PieceLayout[] }[] => {
    const [layoutFrom, layoutTo] = layout
    const area = { seed, wear, xFrom: COVERING_EAVE_X, xTo: SLOPE_LENGTH + COVERING_BASE * Math.tan(HOUSE.pitch), zFrom: layoutFrom, zTo: layoutTo, base: COVERING_BASE }
    if (material === 'tile') {
      const { pans, caps } = layoutTiles(area, TILE)
      return [{ course: 'pan', pieces: piecesInSpan(pans, zFrom, zTo, false) }, { course: 'cap', pieces: piecesInSpan(caps, zFrom, zTo, false) }]
    }
    if (material === 'wood-shake') {
      return [{ course: 'shake', pieces: piecesInSpan(layoutShakes(area, SHAKE), zFrom, zTo, true) }]
    }
    return [{ course: 'shingle', pieces: piecesInSpan(layoutShingles(area, SHINGLE), zFrom, zTo, true) }]
  }, [material, wear, zFrom, zTo, layout, seed])

  const colours = COVERING_COLORS[material ?? 'shingle'] ?? COVERING_COLORS.shingle
  const color = wornColor(newTone ?? colours.new, colours.worn, wear)
  const tile = material === 'tile'

  return (
    <group userData={BLUEPRINT_OMIT_TAG}>
      {courses.map(({ course, pieces }) => (
        <InstancedPieces
          key={course}
          geometry={geometries[course]}
          pieces={pieces}
          color={color}
          stretchToWidth={!tile}
          roughness={wornValue(0.8, 0.95, wear)}
          doubleSided={tile}
        />
      ))}
    </group>
  )
}
