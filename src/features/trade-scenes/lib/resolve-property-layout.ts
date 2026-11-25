import type { LotOrigin, Mass, PropertyLayout, ResolvedLayout } from '@/features/trade-scenes/types'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { fenceCellMask } from '@/features/trade-scenes/lib/fence-cells'
import { heightOnRows } from '@/features/trade-scenes/lib/height-on-rows'
import { layoutFenceBoxes } from '@/features/trade-scenes/lib/layout-fence-boxes'
import { layoutGroundRows } from '@/features/trade-scenes/lib/layout-ground-rows'
import { layoutLotBoxes } from '@/features/trade-scenes/lib/layout-lot-boxes'
import { lotFenceLines } from '@/features/trade-scenes/lib/lot-fences'
import { lotRegions } from '@/features/trade-scenes/lib/lot-regions'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'
import { worldRectOf } from '@/features/trade-scenes/lib/tile-at'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'
import { yardMap } from '@/features/trade-scenes/lib/yards'

function mainMassOf(layout: PropertyLayout): Mass {
  const main = layout.house.masses.find(mass => mass.role === 'main')
  if (!main) {
    throw new Error('A property layout has one main mass.')
  }
  return main
}

// The house is still drawn from its constants, so the main mass's front-left corner is pinned to the house's.
export function lotOrigin(layout: PropertyLayout): LotOrigin {
  const main = mainMassOf(layout)
  return {
    originX: -HOUSE.halfLength - metresOf(main.c0, layout.tile),
    frontZ: HOUSE.halfDepth + metresOf(main.r0, layout.tile),
    tile: layout.tile,
  }
}

export function resolvePropertyLayout(layout: PropertyLayout): ResolvedLayout {
  const origin = lotOrigin(layout)
  const { originX, frontZ, tile } = origin
  const bounds = { left: originX, right: originX + metresOf(layout.lot.cols, tile), front: frontZ, back: frontZ - metresOf(layout.lot.rows, tile) }
  const groundRows = layoutGroundRows(layout, origin)
  const heightAt = (z: number) => heightOnRows(groundRows, z)
  const mask = massMask(layout)
  const fenceMask = fenceCellMask(layout.lot, mask)
  const fences = lotFenceLines(layout, fenceMask)
  const garage = layout.house.masses.find(mass => mass.role === 'garage')
  const yards = yardMap(layout)
  return {
    layout,
    origin,
    bounds,
    groundRows,
    heightAt,
    mask,
    yards,
    regions: lotRegions(layout.lot, mask, yards),
    fenceMask,
    fences,
    main: worldRectOf(origin, mainMassOf(layout)),
    garage: garage ? worldRectOf(origin, garage) : null,
    boxes: layoutLotBoxes(layout, origin, bounds),
    fenceBoxes: {
      existing: layoutFenceBoxes(layout, origin, heightAt, fences, fenceMask, 'existing'),
      proposed: layoutFenceBoxes(layout, origin, heightAt, fences, fenceMask, 'proposed'),
    },
  }
}
