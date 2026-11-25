import type { LotOrigin, PropertyLayout } from '@/features/trade-scenes/types'
import { FAR_RISE, GRADE, STREET_BAND } from '@/features/trade-scenes/constants/home-lot'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'

// The ground's cross-section along z, as the scene's own rows run, from the layout's front and grade. It steps down to
// the street just behind each curb's face, so the curb hides the step.
export function layoutGroundRows(layout: PropertyLayout, origin: LotOrigin): readonly (readonly [number, number])[] {
  const { grade } = layout.lot
  const front = origin.frontZ
  const walk = -grade.walkDrop
  const street = -grade.streetDrop
  const curb = front + STREET_BAND.sidewalk + STREET_BAND.parkway
  const farCurb = curb + STREET_BAND.street
  const farWalkEnd = farCurb + STREET_BAND.parkway + STREET_BAND.sidewalk
  return [
    [-140, 0],
    [front - metresOf(grade.padEndRow, layout.tile), 0],
    [front, walk],
    [curb + GRADE.curb - 0.01, walk],
    [curb + GRADE.curb, street],
    [farCurb - GRADE.curb, street],
    [farCurb - GRADE.curb + 0.01, walk],
    [farWalkEnd, walk],
    [farWalkEnd + FAR_RISE, 0],
    [140, 0],
  ]
}
