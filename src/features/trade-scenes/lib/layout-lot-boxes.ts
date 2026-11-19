import type { BoxSpec, LayoutLotBoxes, LotBounds, LotOrigin, PropertyLayout } from '@/features/trade-scenes/types'
import { GROUND_MATERIAL_INDEX } from '@/features/trade-scenes/constants/ground-materials'
import { GRADE, STREET_BAND } from '@/features/trade-scenes/constants/home-lot'
import { SLAB, streetBand } from '@/features/trade-scenes/lib/lot-box-parts'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'

const APRON_MIN_TILES = 4
// A paver driveway still meets the street over the city's concrete apron.
const APRON_LIST = new Map<number, 'concrete' | 'asphalt'>([
  [GROUND_MATERIAL_INDEX.concrete, 'concrete'],
  [GROUND_MATERIAL_INDEX.pavers, 'concrete'],
  [GROUND_MATERIAL_INDEX.asphalt, 'asphalt'],
])

export function layoutLotBoxes(layout: PropertyLayout, origin: LotOrigin, bounds: LotBounds): LayoutLotBoxes {
  const { tile, lot } = layout
  const colX = (col: number) => origin.originX + metresOf(col, tile)

  const grade = { walk: -lot.grade.walkDrop, street: -lot.grade.streetDrop, curb: GRADE.curb }
  const street = streetBand(bounds.front, grade)
  const curbFace = bounds.front + STREET_BAND.sidewalk + STREET_BAND.parkway + GRADE.curb
  const aprons = { concrete: [] as BoxSpec[], asphalt: [] as BoxSpec[] }
  // Row 0 meets the street: a paved run wide enough to drive crosses the sidewalk and the parkway to the curb.
  let start = 0
  for (let c = 1; c <= lot.cols; c++) {
    if (c < lot.cols && lot.existing[c] === lot.existing[start]) {
      continue
    }
    const list = APRON_LIST.get(lot.existing[start])
    if (list && c - start >= APRON_MIN_TILES) {
      const x0 = colX(start)
      const x1 = colX(c)
      aprons[list].push({ size: [x1 - x0 + 1.2, SLAB, curbFace - bounds.front], position: [(x0 + x1) / 2, grade.walk + SLAB / 2, (bounds.front + curbFace) / 2] })
    }
    start = c
  }

  return {
    concrete: [...aprons.concrete, ...street.concrete],
    asphalt: [...street.asphalt, ...aprons.asphalt],
  }
}
