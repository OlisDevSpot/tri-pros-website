import type { BoxSpec, FenceAxis, FenceBoxes, FenceKindId, GroundLayer, LineRange, PropertyLayout } from '@/features/trade-scenes/types'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DRAW_ERASE } from '@/features/trade-scenes/constants/draw-pick'
import { FENCE_KIND_IDS, FENCE_KIND_INDEX, FENCE_KINDS, FENCE_KINDS_BY_LAYER, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { GROUND_BASE, GROUND_MATERIAL_IDS, GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_MATERIALS_BY_LAYER, GROUND_WEAR_INDEX, GROUND_WEAR_NONE, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { FRONT_STOOP } from '@/features/trade-scenes/constants/home-details'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, GRADE, GROUND_ROWS, LOT, LOT_PALETTE, MULCH_BEDS, STREET_BAND, WALK } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { SCENE_VIEW_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { LAYOUT_EDITOR_COPY } from '@/features/trade-scenes/constants/layout-editor-copy'
import { DEFAULT_LAYOUT } from '@/features/trade-scenes/constants/layout-fixtures'
import { FEET_PER_METRE, FENCE_MESH_TAP_SHARE, LAYOUT_TILE, LINE_TAP_SHARE, MAGNET_TILES } from '@/features/trade-scenes/constants/layout-grid'
import { LAYOUT_URL_MAX, propertyLayoutParser } from '@/features/trade-scenes/constants/property-layout-query-parsers'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { applyFenceStroke, applyStroke, commitLayout, createLayoutEditor, endDrawing, pushUndo, startDrawing, undoLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { drawOffer, drawPickFor, fenceBrushFor, fenceStrokeBrush, groundBrushFor, groundStrokeBrush } from '@/features/trade-scenes/lib/draw-brush'
import { fenceCellIndex, fenceCellMask, fenceMapSizes, isFrontYardCell } from '@/features/trade-scenes/lib/fence-cells'
import { fenceKindAt } from '@/features/trade-scenes/lib/fence-kind-at'
import { fenceLineNear, lineRangeBetween, magnetVertex, vertexAlong } from '@/features/trade-scenes/lib/fence-stroke'
import { formatFeet, formatSquareFeet } from '@/features/trade-scenes/lib/format-feet'
import { packAppearance } from '@/features/trade-scenes/lib/ground-appearance'
import { groundDraw, lotTextureRequests } from '@/features/trade-scenes/lib/ground-draw'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { decodePropertyLayout, encodePropertyLayout } from '@/features/trade-scenes/lib/layout-codec'
import { boards, padToFront, WALL_CAP, WALL_T } from '@/features/trade-scenes/lib/lot-box-parts'
import { LOT_BOXES } from '@/features/trade-scenes/lib/lot-boxes'
import { fenceLengthM, fenceLineAt, fenceLineCells, lotFenceLines, perimeterSideOf } from '@/features/trade-scenes/lib/lot-fences'
import { lotRegions, regionAreaM2, regionAt, regionTileIndices } from '@/features/trade-scenes/lib/lot-regions'
import { fenceTapTile, lotTapTarget } from '@/features/trade-scenes/lib/lot-tap'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'
import { paintFenceCells, paintFenceList } from '@/features/trade-scenes/lib/paint-fence'
import { paintTiles, rectBetween } from '@/features/trade-scenes/lib/paint-tiles'
import { perimeterKindsFor } from '@/features/trade-scenes/lib/perimeter-kinds'
import { regionRings } from '@/features/trade-scenes/lib/region-rings'
import { lotOrigin, resolvePropertyLayout } from '@/features/trade-scenes/lib/resolve-property-layout'
import { retilePropertyLayout } from '@/features/trade-scenes/lib/retile-property-layout'
import { regionSelectionAt } from '@/features/trade-scenes/lib/selection-at'
import { drawnAppearance, groundStripKeys, shownGround } from '@/features/trade-scenes/lib/shown-ground'
import { tileAt, vertexAt, worldRectOf } from '@/features/trade-scenes/lib/tile-at'
import { metresOf, tilesOf } from '@/features/trade-scenes/lib/tile-units'
import { removeFenceLine, removeRegion, setYardBase, setYardBuild, setYardFence, setYardGround, yardBuildChanges, yardFence, yardGroundBuild, yardGroundToday } from '@/features/trade-scenes/lib/yard-picks'
import { presentYards, yardLotLineCells, yardMap, yardOfTile, yardTileIndices } from '@/features/trade-scenes/lib/yards'
import { LAYOUT_MAX_TILES_PER_SIDE, LAYOUT_MAX_WIRE_TILE } from '@/features/trade-scenes/schemas/property-layout'
import { createSceneCamera, setSceneCameraDrawing } from '@/shared/components/scene/lib/create-scene-camera'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'
import { materialBenefitsData } from '@/shared/db/seeds/data/x-material-benefits'
import { xScopeMaterialsData } from '@/shared/db/seeds/data/x-scope-materials'

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`)
}

near(LAYOUT_TILE * FEET_PER_METRE, 2, 1e-3, 'the tile is two feet')
near(metresOf(tilesOf(12, LAYOUT_TILE), LAYOUT_TILE), 12, LAYOUT_TILE / 2, 'metres survive a round trip through tiles')

assert.equal(GROUND_MATERIAL_IDS.length, 11, 'eleven ground materials')
const scopesSeed = readFileSync('src/shared/db/seeds/data/scopes.ts', 'utf8')
const materialsSeed = readFileSync('src/shared/db/seeds/data/materials.ts', 'utf8')
let materialsChecked = 0
for (const id of GROUND_MATERIAL_IDS) {
  const material = GROUND_MATERIALS[id]
  materialsChecked++
  assert.equal(groundMaterialAt(GROUND_MATERIAL_INDEX[id]), id, `${id}: its tile value maps back to it`)
  assert.ok(material.label.length > 0, `${id} has a label`)
  assert.ok(material.sets.length > 0, `${id} sets at least one layer`)
  assert.match(material.look.color, /^#[0-9a-f]{6}$/, `${id} colour is a hex`)
  if (material.sets.includes('proposed')) {
    assert.ok(material.catalog, `${id} is proposable, so it links to the catalog`)
  }
  if (material.catalog) {
    assert.ok(scopesSeed.includes(`'${material.catalog.scopeAccessor}'`), `${id}: scope ${material.catalog.scopeAccessor} is in the seed`)
    assert.ok(materialsSeed.includes(`'${material.catalog.materialAccessor}'`), `${id}: material ${material.catalog.materialAccessor} is in the seed`)
  }
}
assert.equal(materialsChecked, 11, 'the material loop covers all eleven')
assert.deepEqual(GROUND_MATERIALS.pool.sets, ['existing'], 'a pool is only ever existing')
assert.ok(GROUND_MATERIALS.pool.look.raise > 0, 'the pool strip stands above the lawn')
assert.equal(GROUND_MATERIAL_INDEX.sod, 1, 'sod is the first material')
assert.equal(groundMaterialAt(0), null, 'zero is unset')
assert.equal(groundMaterialAt(GROUND_MATERIAL_INDEX.pool), 'pool', 'a tile value maps back to its material')
assert.equal(FENCE_KIND_IDS.length, 11, 'eleven fence kinds')
assert.equal(FENCE_NONE, 0, 'no fence is the map\'s zero')
const paletteColours: readonly string[] = [...Object.values(LOT_PALETTE), ...Object.values(HOME_PALETTE)]
let kindsChecked = 0
for (const id of FENCE_KIND_IDS) {
  const kind = FENCE_KINDS[id]
  kindsChecked++
  assert.equal(fenceKindAt(FENCE_KIND_INDEX[id]), id, `${id}: its map value maps back to it`)
  assert.ok(kind.label.length > 0 && kind.sets.length > 0, `${id} has a label and a layer`)
  assert.equal(id.endsWith('Gate'), kind.gate, `${id}: a gate is a gate`)
  assert.ok(paletteColours.includes(kind.look.color), `${id}: its preview colour is a palette colour`)
  if (kind.sets.includes('proposed')) {
    assert.ok(kind.catalog, `${id} is on the Build row, so it links to the catalog`)
  }
  if (kind.catalog) {
    const { scopeAccessor, materialAccessor } = kind.catalog
    assert.ok(xScopeMaterialsData.some(link => link.scopeAccessor === scopeAccessor && link.materialAccessor === materialAccessor), `${id}: ${materialAccessor} is linked to ${scopeAccessor}`)
    assert.ok((materialBenefitsData[materialAccessor as keyof typeof materialBenefitsData]?.length ?? 0) > 0, `${id}: ${materialAccessor} lists benefits`)
  }
}
assert.equal(kindsChecked, 11, 'the kind loop covers all eleven')
assert.equal(fenceKindAt(FENCE_NONE), null, 'zero is no kind')
assert.deepEqual(FENCE_KINDS.chainLink.sets, ['existing'], 'chain link is today-only')
assert.equal(FENCE_KIND_INDEX.woodFence, 1, 'wood fence is the first kind')
assert.equal(FENCE_KINDS.vinylFence.catalog?.materialAccessor, 'vinylFencing')
assert.equal(FENCE_KINDS.lowWall.catalog?.scopeAccessor, 'installBlockWall')
assert.ok(xScopeMaterialsData.some(link => link.materialAccessor === 'vinylFencing' && link.isMostPopular), 'vinyl is the most popular fencing')

const literal = String(LAYOUT_TILE)
const holders: string[] = []
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path)
    }
    else if (/\.tsx?$/.test(name) && !path.endsWith('verify-property-layout.ts') && readFileSync(path, 'utf8').includes(literal)) {
      holders.push(path)
    }
  }
}
walk('src/features/trade-scenes')
walk('scripts')
assert.deepEqual(holders, ['src/features/trade-scenes/constants/layout-grid.ts'], 'the tile size literal lives in one file')

const layout = DEFAULT_LAYOUT
const { lot, house, tile } = layout
assert.equal(lot.existing.length, lot.cols * lot.rows, 'existing covers the grid')
assert.equal(lot.proposed.length, lot.cols * lot.rows, 'proposed covers the grid')
assert.ok(lot.proposed.every(v => v === 0), 'nothing is proposed yet')
assert.equal(house.masses.length, 2, 'a house and a garage')
assert.equal(house.masses.filter(m => m.role === 'main').length, 1, 'one main mass')
const main = house.masses.find(m => m.role === 'main')!
const garage = house.masses.find(m => m.role === 'garage')!
near(metresOf(main.c0, tile), -HOUSE.halfLength - LOT.left, LAYOUT_TILE, 'main mass column')
near(metresOf(main.r0, tile), LOT.front - HOUSE.halfDepth, LAYOUT_TILE, 'main mass row')
near(metresOf(main.cols, tile), 2 * HOUSE.halfLength, LAYOUT_TILE, 'main mass width')
near(metresOf(main.rows, tile), 2 * HOUSE.halfDepth, LAYOUT_TILE, 'main mass depth')
near(metresOf(garage.c0, tile), GARAGE.x0 - LOT.left, LAYOUT_TILE, 'garage column')
near(metresOf(garage.r0, tile), LOT.front - GARAGE.z1, LAYOUT_TILE, 'garage row')
near(metresOf(garage.cols, tile), GARAGE.x1 - GARAGE.x0, LAYOUT_TILE, 'garage width')
near(metresOf(garage.rows, tile), GARAGE.z1 - GARAGE.z0, LAYOUT_TILE, 'garage depth')
near(metresOf(lot.cols, tile), LOT.right - LOT.left, LAYOUT_TILE, 'lot width')
near(metresOf(lot.rows, tile), LOT.front - LOT.back, LAYOUT_TILE, 'lot depth')

const concreteTiles = lot.existing.filter(v => v === GROUND_MATERIAL_INDEX.concrete).length
const concreteMetres2 = (GARAGE.x1 - GARAGE.x0 - 0.3) * (LOT.front - GARAGE.z1) + (WALK.x1 - WALK.x0) * (LOT.front - HOUSE.halfDepth - 0.9)
near(concreteTiles, concreteMetres2 / (tile * tile), 0.1 * concreteMetres2 / (tile * tile), 'driveway and walk tile count')

let mulchRuns = 0
for (let r = 0; r < lot.rows; r++) {
  for (let c = 0; c < lot.cols; c++) {
    if (lot.existing[r * lot.cols + c] === GROUND_MATERIAL_INDEX.mulch && (c === 0 || lot.existing[r * lot.cols + c - 1] !== GROUND_MATERIAL_INDEX.mulch)) {
      const above = r > 0 && lot.existing[(r - 1) * lot.cols + c] === GROUND_MATERIAL_INDEX.mulch
      if (!above) {
        mulchRuns++
      }
    }
  }
}
assert.equal(mulchRuns, 3, 'three separate mulch beds')

for (const mass of house.masses) {
  for (let r = mass.r0; r < mass.r0 + mass.rows; r++) {
    for (let c = mass.c0; c < mass.c0 + mass.cols; c++) {
      assert.equal(lot.existing[r * lot.cols + c], GROUND_MATERIAL_INDEX.sod, `${mass.id} is not painted: (${c}, ${r})`)
    }
  }
}

for (const [i, bed] of MULCH_BEDS.entries()) {
  const c0 = tilesOf(bed.x0 - LOT.left, tile)
  const c1 = tilesOf(bed.x1 - LOT.left, tile)
  const r0 = tilesOf(LOT.front - bed.z1, tile)
  const r1 = tilesOf(LOT.front - bed.z0, tile)
  assert.ok(c1 > c0 && r1 > r0, `mulch bed ${i} covers tiles`)
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      assert.equal(lot.existing[r * lot.cols + c], GROUND_MATERIAL_INDEX.mulch, `mulch bed ${i} is mulch at (${c}, ${r})`)
    }
  }
}

const sideYardRow = tilesOf(LOT.front - LOT.gateZ, tile)
const sizes = fenceMapSizes(lot)
assert.equal(lot.fence.existing.across.length, sizes.across, 'one across cell per column on every line')
assert.equal(lot.fence.existing.along.length, sizes.along, 'one along cell per row on every line')
assert.ok(lot.fence.proposed.across.every(v => v === 0) && lot.fence.proposed.along.every(v => v === 0), 'the default proposes no fence')
const K = FENCE_KIND_INDEX
const across = (line: number, cell: number) => lot.fence.existing.across[fenceCellIndex(lot, 'across', line, cell)]
const along = (line: number, cell: number) => lot.fence.existing.along[fenceCellIndex(lot, 'along', line, cell)]
assert.equal(fenceCellIndex(lot, 'along', 1, 0), lot.rows, 'the along map is line-major: line 1 starts after one line of rows cells')
for (let c = 0; c < lot.cols; c++) {
  assert.equal(across(lot.rows, c), K.blockWall, `the back line is block wall at ${c}`)
  assert.equal(across(0, c), 0, `the front line is open at ${c}`)
}
for (let r = 0; r < lot.rows; r++) {
  assert.equal(along(0, r), r < sideYardRow ? K.lowWall : K.blockWall, `the left line at row ${r}`)
  assert.equal(along(lot.cols, r), r < sideYardRow ? 0 : K.blockWall, `the right line at row ${r}`)
}
const sideYardCells = Array.from({ length: lot.cols }, (_, c) => across(sideYardRow, c))
assert.ok(sideYardCells.slice(0, main.c0).every(v => v === K.woodFence), 'the left side yard is fenced at the side-yard row')
assert.ok(sideYardCells.slice(garage.c0 + garage.cols).every(v => v === K.woodFence), 'the right side yard is fenced at the side-yard row')
assert.ok(sideYardCells.slice(main.c0, garage.c0 + garage.cols).every(v => v === 0), 'nothing is drawn under the house')
const mask = massMask(layout)
const cellMask = fenceCellMask(lot, mask)
assert.equal(cellMask.across[fenceCellIndex(lot, 'across', main.r0 + 1, main.c0 + 1)], 1, 'a line through the house is unpaintable')
assert.equal(cellMask.across[fenceCellIndex(lot, 'across', main.r0, main.c0 + 1)], 0, 'the house\'s front face is paintable')
assert.equal(cellMask.along[fenceCellIndex(lot, 'along', main.c0, main.r0 + 1)], 0, 'the house\'s left face is paintable')
assert.equal(cellMask.along[fenceCellIndex(lot, 'along', main.c0 + 1, main.r0 + 1)], 1, 'a line one tile inside the house is not')
const onPerimeter = (axis: FenceAxis, line: number) => perimeterSideOf(lot, { axis, line, from: 0, to: 1 }) !== null
assert.ok(onPerimeter('across', 0) && onPerimeter('along', lot.cols) && !onPerimeter('across', sideYardRow), 'the lot lines are the perimeter')
assert.ok(isFrontYardCell(main, 'across', 0, 3) && isFrontYardCell(main, 'along', 0, 0) && isFrontYardCell(main, 'across', main.r0, 0), 'the front lot line, the first row and the face line are in the front yard')
assert.ok(!isFrontYardCell(main, 'across', sideYardRow, 0) && !isFrontYardCell(main, 'along', 0, main.r0) && !isFrontYardCell(main, 'along', 0, lot.rows - 1), 'the side-yard row, the face row\'s along cell and the back are not')
{
  const painted = paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: lot.rows - 2, from: 2, to: 6 }, K.vinylFence, cellMask)
  assert.notEqual(painted, lot.fence.proposed, 'a paint that changes a cell returns a new map')
  assert.equal(painted.across[fenceCellIndex(lot, 'across', lot.rows - 2, 4)], K.vinylFence)
  assert.equal(painted.across[fenceCellIndex(lot, 'across', lot.rows - 2, 6)], 0, 'the cell past `to` is untouched')
  assert.equal(painted.along, lot.fence.proposed.along, 'the other axis is shared, untouched')
  assert.equal(paintFenceCells(painted, lot, { axis: 'across', line: lot.rows - 2, from: 2, to: 6 }, K.vinylFence, cellMask), painted, 'a no-op paint returns the same map')
  assert.equal(paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, K.vinylFence, cellMask), lot.fence.proposed, 'a paint through the house changes nothing')
  assert.equal(paintFenceCells(lot.fence.proposed, lot, { axis: 'along', line: 3, from: lot.rows - 2, to: lot.rows + 5 }, K.vinylFence, cellMask).along.filter(v => v === K.vinylFence).length, 2, 'cells past the line\'s end are skipped')
  const listed = paintFenceList(lot.fence.proposed, 'along', [fenceCellIndex(lot, 'along', 3, 3), -1, 10 ** 6], K.ironGate, cellMask)
  assert.equal(listed.along[fenceCellIndex(lot, 'along', 3, 3)], K.ironGate, 'a list paints its cells and skips indices off the map')
}
assert.equal(layout.source, 'default')
assert.equal(layout.tile, LAYOUT_TILE)

function signedArea(ring: readonly (readonly [number, number])[]) {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

const blank = new Uint8Array(12)
const painted = paintTiles(blank, 4, 3, { c0: 2, r0: 1, cols: 5, rows: 5 }, 7)
assert.notEqual(painted, blank, 'painting returns a new array')
assert.ok(blank.every(v => v === 0), 'painting never mutates its input')
assert.deepEqual([...painted], [0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 7, 7], 'an overhanging rect paints only the 2 x 2 inside the grid')
assert.equal(paintTiles(painted, 4, 3, { c0: 2, r0: 1, cols: 5, rows: 5 }, 7), painted, 'painting the same value again returns the same instance')
const paintMask = new Uint8Array(12)
paintMask[6] = 1
const maskedPaint = paintTiles(painted, 4, 3, { c0: 0, r0: 0, cols: 4, rows: 3 }, 3, paintMask)
assert.equal(maskedPaint[6], 7, 'a masked tile keeps its value')
assert.equal(maskedPaint.filter(v => v === 3).length, 11, 'every unmasked tile takes the paint')
assert.deepEqual([...painted], [0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 7, 7], 'a masked paint never mutates its input')

assert.deepEqual(rectBetween([3, 4], [1, 2]), { c0: 1, r0: 2, cols: 3, rows: 3 }, 'a drag in either direction gives the inclusive rectangle')

const square = regionRings(new Set([0, 1, 4, 5]), 4)
assert.deepEqual(square, [[[0, 0], [2, 0], [2, 2], [0, 2]]], 'a 2 x 2 block is one ring of four corners')
assert.ok(signedArea(square[0]) > 0, 'the outer ring has positive shoelace area over (column, row)')
const ell = regionRings(new Set([0, 1, 4]), 4)
assert.equal(ell.length, 1, 'an L is one ring')
assert.equal(ell[0].length, 6, 'an L has six corners')
const donut = regionRings(new Set([0, 1, 2, 4, 6, 8, 9, 10]), 4)
assert.equal(donut.length, 2, 'a block with its centre missing has an outer ring and a hole')
assert.equal(donut[0].length, 4, 'the donut outer ring has four corners')
assert.equal(donut[1].length, 4, 'the hole has four corners')
assert.ok(signedArea(donut[0]) > 0, 'the donut outer ring has positive shoelace area')
assert.ok(signedArea(donut[1]) < 0, 'the hole has negative shoelace area')
assert.equal(regionRings(new Set([0, 1, 4, 6, 8, 9, 10]), 4).length, 1, 'a gap that meets the outside at a corner is no hole')

const sod = GROUND_MATERIAL_INDEX.sod
const mulch = GROUND_MATERIAL_INDEX.mulch
const concrete = GROUND_MATERIAL_INDEX.concrete
let smallExisting: Uint8Array = new Uint8Array(24).fill(sod)
smallExisting = paintTiles(smallExisting, 6, 4, { c0: 0, r0: 0, cols: 2, rows: 2 }, mulch)
smallExisting = paintTiles(smallExisting, 6, 4, { c0: 4, r0: 0, cols: 2, rows: 2 }, mulch)
smallExisting = paintTiles(smallExisting, 6, 4, { c0: 5, r0: 3, cols: 1, rows: 1 }, 0)
const smallProposed = paintTiles(new Uint8Array(24), 6, 4, { c0: 3, r0: 2, cols: 3, rows: 2 }, concrete)
const smallLot = { ...DEFAULT_LAYOUT.lot, cols: 6, rows: 4, existing: smallExisting, proposed: smallProposed }
const smallMask = new Uint8Array(24)
smallMask[18] = 1
const smallYards = new Int8Array(24).fill(0)
const small = lotRegions(smallLot, smallMask, smallYards)
assert.equal(small.length, 4, 'the 6 x 4 lot has four regions')
assert.equal(small.filter(r => r.existing === 'mulch').length, 2, 'two separate mulch blocks are two regions')
assert.equal(small.filter(r => r.existing === 'sod').length, 2, 'a different proposed splits the sod')
assert.ok(small.every(r => r.rings.length >= 1), 'every region has an outer ring')
for (let i = 1; i < small.length; i++) {
  const [a, b] = [small[i - 1].bbox, small[i].bbox]
  assert.ok(a.r0 < b.r0 || (a.r0 === b.r0 && a.c0 <= b.c0), 'regions are ordered by bbox row, then column')
}
const at = (c: number, r: number) => regionAt(small, smallLot, smallMask, smallYards, c, r)
assert.deepEqual([at(1, 1)?.id, at(1, 1)?.existing, at(1, 1)?.proposed, at(1, 1)?.tiles], ['0', 'mulch', null, 4], 'the left mulch block')
assert.deepEqual([at(5, 0)?.id, at(5, 0)?.existing, at(5, 0)?.tiles], ['4', 'mulch', 4], 'the right mulch block')
assert.deepEqual([at(2, 1)?.id, at(2, 1)?.existing, at(2, 1)?.proposed, at(2, 1)?.tiles], ['2', 'sod', null, 9], 'the sod touching the mulch is its own region')
assert.deepEqual([at(4, 3)?.id, at(4, 3)?.existing, at(4, 3)?.proposed, at(4, 3)?.tiles], ['15', 'sod', 'concrete', 5], 'the proposed concrete splits off the sod')
assert.deepEqual(at(1, 1)?.bbox, { c0: 0, r0: 0, cols: 2, rows: 2 }, 'the left mulch bbox')
assert.deepEqual(at(2, 1)?.bbox, { c0: 0, r0: 0, cols: 4, rows: 4 }, 'the sod bbox')
assert.equal(at(0, 3), null, 'a masked tile has no region')
assert.equal(at(5, 3), null, 'an unset tile has no region')
assert.equal(at(6, 0), null, 'a tile off the grid has no region')
for (const region of small) {
  const indices = regionTileIndices(small, smallLot, smallMask, smallYards, region.id)
  assert.equal(indices.length, region.tiles, `region ${region.id}: one index per tile`)
  assert.ok(indices.every(i => regionAt(small, smallLot, smallMask, smallYards, i % 6, Math.floor(i / 6)) === region), `region ${region.id}: every index maps back to it`)
}
assert.deepEqual(regionTileIndices(small, smallLot, smallMask, smallYards, 'nope'), [], 'an unknown region has no tiles')

const block = regionRings(new Set([0, 1, 4, 5, 8, 9]), 4)
const blockRegion = { id: '0', existing: 'sod' as const, proposed: null, wear: 'good' as const, appearanceExisting: 0, appearanceProposed: 0, yard: 'front-yard' as const, base: true, tiles: 6, rings: block, bbox: { c0: 0, r0: 0, cols: 2, rows: 3 } }
near(regionAreaM2(blockRegion, LAYOUT_TILE), 6 * LAYOUT_TILE * LAYOUT_TILE, 1e-9, 'a 2 x 3 block has six tiles of area')

assert.equal(mask.filter(v => v === 1).length, main.cols * main.rows + garage.cols * garage.rows, 'the mass mask covers both masses')
const regions = lotRegions(lot, mask, yardMap(layout))
const sodRegions = regions.filter(r => r.existing === 'sod').sort((a, b) => b.tiles - a.tiles)
assert.equal(sodRegions.filter(r => r.yard === 'back-yard').length, 1, 'the back yard\'s sod is one region')
assert.equal(sodRegions.find(r => r.yard === 'back-yard')!.tiles, yardTileIndices(yardMap(layout), 'back-yard').length, 'the back yard\'s sod is one region of the whole yard')
for (const region of regions) {
  assert.equal(region.rings.length, 1, `${region.existing} region ${region.id} encloses no hole`)
}
const concreteRegions = regions.filter(r => r.existing === 'concrete').sort((a, b) => b.tiles - a.tiles)
assert.equal(concreteRegions.length, 2, 'the driveway and the walk')
assert.equal(regions.filter(r => r.existing === 'mulch').length, 4, 'three mulch beds, the left side bed split in two at the front yard line')
const driveway = concreteRegions[0]
assert.equal(driveway.bbox.cols, tilesOf(GARAGE.x1 - GARAGE.x0 - 0.3, LAYOUT_TILE), 'the driveway is the garage width less its margins')
near(regionAreaM2(driveway, LAYOUT_TILE), (GARAGE.x1 - GARAGE.x0 - 0.3) * (LOT.front - GARAGE.z1), 2 * LAYOUT_TILE * (LOT.front - GARAGE.z1), 'the driveway area')

const encoded = encodePropertyLayout(layout)
assert.ok(encoded.length < 2000, `the default layout encodes to ${encoded.length} characters`)
assert.equal(encodePropertyLayout(layout), encoded, 'encoding is deterministic')
const decoded = decodePropertyLayout(encoded, LAYOUT_TILE)
function fenceArrays(fence: typeof lot.fence) {
  return {
    existing: { across: Array.from(fence.existing.across), along: Array.from(fence.existing.along) },
    proposed: { across: Array.from(fence.proposed.across), along: Array.from(fence.proposed.along) },
  }
}
assert.ok(decoded, 'the default layout decodes')
assert.deepEqual(
  { ...decoded, lot: { ...decoded.lot, existing: Array.from(decoded.lot.existing), proposed: Array.from(decoded.lot.proposed), fence: fenceArrays(decoded.lot.fence) } },
  { ...layout, lot: { ...lot, existing: Array.from(lot.existing), proposed: Array.from(lot.proposed), fence: fenceArrays(lot.fence) } },
  'the default layout survives a round trip',
)
const wire = JSON.parse(encoded)
function reject(label: string, edit: (w: any) => void) {
  const copy = JSON.parse(encoded)
  edit(copy)
  assert.equal(decodePropertyLayout(JSON.stringify(copy), LAYOUT_TILE), null, label)
}
assert.equal(decodePropertyLayout('not json', LAYOUT_TILE), null, 'not JSON is rejected')
const lastRun = /\*(\d+)$/.exec(wire.lot.existing)
assert.ok(lastRun && Number(lastRun[1]) >= 2, 'the shortened run stays a valid run')
reject('runs one tile short are rejected', (w) => {
  w.lot.existing = w.lot.existing.replace(/\*(\d+)$/, (_m: string, n: string) => `*${Number(n) - 1}`)
})
reject('a zero-count run is rejected', (w) => {
  w.lot.proposed = `0*0,${w.lot.proposed}`
})
reject('a fractional value is rejected', (w) => {
  w.lot.proposed = `1.5*${wire.lot.c * wire.lot.r}`
})
reject('a tile value of 99 is rejected', (w) => {
  w.lot.proposed = `99*${wire.lot.c * wire.lot.r}`
})
reject('a mass past the lot is rejected', (w) => {
  w.house.masses[0].c0 = wire.lot.c - w.house.masses[0].cols + 1
})
reject('overlapping masses are rejected', (w) => {
  Object.assign(w.house.masses[1], { c0: w.house.masses[0].c0, r0: w.house.masses[0].r0, cols: 1, rows: 1 })
})
reject('two mains are rejected', (w) => {
  w.house.masses[1].role = 'main'
})
reject('no main is rejected', (w) => {
  w.house.masses[0].role = 'wing'
})
reject('a huge lot is rejected before anything is allocated', (w) => {
  w.lot.c = 100000
  w.lot.r = 100000
})
reject('an unknown roof is rejected', (w) => {
  w.house.roof = 'dome'
})
reject('a wire version 1 is rejected', (w) => {
  w._v = 1
})
reject('a wire tile 200 times the grid tile is rejected', (w) => {
  w.t = LAYOUT_TILE * 200
})
reject('a zero wire tile is rejected', (w) => {
  w.t = 0
})
reject('a negative wire tile is rejected', (w) => {
  w.t = -1
})
assert.ok(Math.round(wire.lot.c * LAYOUT_MAX_WIRE_TILE / LAYOUT_TILE) > LAYOUT_MAX_TILES_PER_SIDE, 'the largest wire tile re-tiles the default grid past the cap')
reject('a wire tile that re-tiles past the cap is rejected before the re-tile', (w) => {
  w.t = LAYOUT_MAX_WIRE_TILE
})
reject('a fence map one cell short is rejected', (w) => {
  w.lot.fence.existing.across = w.lot.fence.existing.across.replace(/\*(\d+)$/, (_m: string, n: string) => `*${Number(n) - 1}`)
})
reject('a fence kind of 12 is rejected', (w) => {
  w.lot.fence.proposed.along = `12*${fenceMapSizes({ cols: wire.lot.c, rows: wire.lot.r }).along}`
})
reject('chain link on the build map is rejected: the build row does not offer it', (w) => {
  w.lot.fence.proposed.across = `${FENCE_KIND_INDEX.chainLink}*${fenceMapSizes({ cols: wire.lot.c, rows: wire.lot.r }).across}`
})
reject('a payload without fences is rejected', (w) => {
  delete w.lot.fence
})
assert.equal(wire._v, 4, 'the wire is version 4')
assert.ok(!('edges' in wire.lot) && !('gates' in wire.lot), 'the wire carries neither of version 1\'s fence lists')
console.log(`  default layout URL length: ${encoded.length} of ${LAYOUT_URL_MAX}`)
assert.ok(encoded.length < 2000, 'the default lot\'s link stays short (1,292 before fences; the along map is line-major so a lot line is one run)')
const fromCoarse = decodePropertyLayout(JSON.stringify({ ...wire, t: LAYOUT_TILE * 2 }), LAYOUT_TILE)
assert.equal(fromCoarse?.tile, LAYOUT_TILE, 'a layout at twice the tile decodes at the asked tile')
assert.equal(fromCoarse?.lot.cols, 2 * wire.lot.c, 'twice the tile re-tiles to twice the columns')
assert.equal(fromCoarse?.lot.rows, 2 * wire.lot.r, 'twice the tile re-tiles to twice the rows')

const half = LAYOUT_TILE / 2
const fine = retilePropertyLayout(layout, half)
assert.equal(retilePropertyLayout(layout, LAYOUT_TILE), layout, 'a same-tile re-tile returns the input')
assert.equal(fine.tile, half)
assert.equal(fine.lot.existing.length, 4 * lot.existing.length, 'half the tile is four times the tiles')
const fineConcrete = fine.lot.existing.filter(v => v === GROUND_MATERIAL_INDEX.concrete).length
near(fineConcrete, 4 * concreteTiles, 0.02 * 4 * concreteTiles, 'concrete area survives a re-tile')
const coarse = retilePropertyLayout(fine, LAYOUT_TILE)
const { id: _id, stories: _s, role: _r, ridgeAxis: _a, ...mainRect } = coarse.house.masses.find(m => m.role === 'main')!
assert.deepEqual(mainRect, { c0: main.c0, r0: main.r0, cols: main.cols, rows: main.rows }, 'the main mass rect survives a round trip through half tiles')
const abutting = {
  ...layout,
  house: { ...layout.house, masses: [
    { ...main, c0: 2, r0: 2, cols: 1, rows: 2 },
    { ...garage, c0: 3, r0: 2, cols: 3, rows: 2 },
  ], rooms: [] },
}
const [leftMass, rightMass] = retilePropertyLayout(abutting, LAYOUT_TILE / 1.5).house.masses
assert.equal(leftMass.c0 + leftMass.cols, rightMass.c0, 'abutting masses still abut at a non-integer scale')
const third = retilePropertyLayout(layout, LAYOUT_TILE / 1.5)
near(third.lot.existing.filter(v => v === GROUND_MATERIAL_INDEX.concrete).length, 2.25 * concreteTiles, 0.05 * 2.25 * concreteTiles, 'concrete area survives a 1.5 re-tile')
{
  const gated = { ...layout, lot: { ...lot, fence: { ...lot.fence, existing: paintFenceCells(lot.fence.existing, lot, { axis: 'across', line: lot.rows, from: 5, to: 6 }, K.woodGate, cellMask) } } }
  const fine = retilePropertyLayout(gated, LAYOUT_TILE / 2)
  const fineAcross = (line: number) => Array.from({ length: fine.lot.cols }, (_, c) => fine.lot.fence.existing.across[fenceCellIndex(fine.lot, 'across', line, c)])
  const fineAlong = (line: number) => Array.from({ length: fine.lot.rows }, (_, r) => fine.lot.fence.existing.along[fenceCellIndex(fine.lot, 'along', line, r)])
  assert.equal(fineAcross(fine.lot.rows).filter(v => v === K.woodGate).length, 2, 'a one-cell gate is two cells at 1 ft')
  assert.ok(fineAcross(fine.lot.rows - 1).every(v => v === 0) && fineAcross(2 * sideYardRow - 1).every(v => v === 0), 'no across line doubles at 1 ft')
  assert.ok(fineAlong(1).every(v => v === 0) && fineAlong(fine.lot.cols - 1).every(v => v === 0), 'no along line doubles at 1 ft')
  const acrossLinesUsed = Array.from({ length: fine.lot.rows + 1 }, (_, l) => l).filter(l => fineAcross(l).some(v => v !== 0))
  assert.deepEqual(acrossLinesUsed, [2 * sideYardRow, fine.lot.rows], 'the side-yard row and the back line are the only across lines at 1 ft')
  for (let r = 0; r < fine.lot.rows; r++) {
    assert.equal(fineAlong(fine.lot.cols)[r], r < sideYardRow * 2 ? 0 : K.blockWall, `the right lot line keeps its wall at 1 ft, row ${r}`)
  }
  const back = retilePropertyLayout(fine, LAYOUT_TILE)
  assert.deepEqual(Array.from(back.lot.fence.existing.across), Array.from(gated.lot.fence.existing.across), 'and one cell again at 2 ft')
  assert.deepEqual(Array.from(back.lot.fence.existing.along), Array.from(gated.lot.fence.existing.along), 'the along map survives the round trip')
}
assert.equal(resolvePropertyLayout(fine).fences.length, 6, 'the default lot re-tiled to 1 ft still has six fence lines')
const fromFine = decodePropertyLayout(encodePropertyLayout(fine), LAYOUT_TILE)
assert.equal(fromFine?.tile, LAYOUT_TILE, 'a layout encoded at another tile decodes at the asked tile')
assert.equal(fromFine?.lot.cols, lot.cols)

const resolved = resolvePropertyLayout(layout)
const { bounds, origin, boxes } = resolved

const fences = resolved.fences
assert.deepEqual(Array.from(resolved.fenceMask.across), Array.from(cellMask.across), 'the resolved fence mask is the cell mask')
assert.equal(fences.length, 6, 'the default lot has six fence lines: back wall, left low wall, left wall, right wall, two side-yard fences')
const backWall = fenceLineAt(fences, 'across', lot.rows, 3)
assert.ok(backWall && backWall.from === 0 && backWall.to === lot.cols && backWall.existing === 'blockWall' && backWall.proposed === null && backWall.perimeter && !backWall.frontYard, 'the back wall is one perimeter line')
assert.equal(backWall.id, `across-${lot.rows}-0`)
assert.equal(perimeterSideOf(lot, backWall), 'back')
const leftLow = fenceLineAt(fences, 'along', 0, 0)
assert.ok(leftLow && leftLow.existing === 'lowWall' && leftLow.to === sideYardRow && !leftLow.frontYard, 'the left low wall runs to the side-yard row, one row past the face, so it is not wholly in the front yard')
assert.equal(fenceLineAt(fences, 'along', 0, sideYardRow)?.existing, 'blockWall', 'the left wall starts at the side-yard row')
assert.equal(fenceLineAt(fences, 'along', lot.cols, 0), null, 'the right front stretch carries nothing')
const leftSideYard = fenceLineAt(fences, 'across', sideYardRow, 0)
assert.ok(leftSideYard && leftSideYard.to === main.c0 && leftSideYard.existing === 'woodFence' && !leftSideYard.perimeter, 'the left side-yard fence ends at the house')
near(fenceLengthM(leftSideYard, tile), -HOUSE.halfLength - LOT.left, LAYOUT_TILE, 'its length is the side yard\'s width')
assert.deepEqual(fenceLineCells(leftSideYard, lot), Array.from({ length: main.c0 }, (_, c) => fenceCellIndex(lot, 'across', sideYardRow, c)))
{
  const withGate = { ...layout, lot: { ...lot, fence: { ...lot.fence, proposed: paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: lot.rows, from: 4, to: 6 }, K.ironGate, cellMask) } } }
  const split = resolvePropertyLayout(withGate).fences.filter(f => f.axis === 'across' && f.line === lot.rows)
  assert.deepEqual(split.map(f => [f.from, f.to, f.existing, f.proposed]), [[0, 4, 'blockWall', null], [4, 6, 'blockWall', 'ironGate'], [6, lot.cols, 'blockWall', null]], 'a gate painted mid-wall splits it into three lines')
  const newFence = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, proposed: paintFenceCells(lot.fence.proposed, lot, { axis: 'along', line: 10, from: main.r0 + main.rows + 2, to: lot.rows }, K.vinylFence, cellMask) } } }).fences.find(f => f.axis === 'along' && f.line === 10)
  assert.ok(newFence && newFence.existing === null && newFence.proposed === 'vinylFence' && !newFence.perimeter && !newFence.frontYard, 'a proposed fence where nothing stands is a line of its own')
  const frontOnly = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, existing: paintFenceCells(lot.fence.existing, lot, { axis: 'along', line: lot.cols, from: 0, to: main.r0 }, K.woodFence, cellMask) } } }).fences.find(f => f.axis === 'along' && f.line === lot.cols && f.from === 0)
  assert.ok(frontOnly?.frontYard, 'a line that stops at the face row is wholly in the front yard')
}
near(bounds.left, LOT.left, LAYOUT_TILE, 'the lot left')
near(bounds.right, LOT.right, LAYOUT_TILE, 'the lot right')
near(bounds.front, LOT.front, LAYOUT_TILE, 'the lot front')
near(bounds.back, LOT.back, LAYOUT_TILE, 'the lot back')
near(resolved.main.x0, -HOUSE.halfLength, 1e-9, 'the main mass stands at the house\'s left face')
near(resolved.main.z1, HOUSE.halfDepth, 1e-9, 'the main mass stands at the house\'s front face')
near(resolved.main.x1, HOUSE.halfLength, LAYOUT_TILE, 'the main mass right')
near(resolved.main.z0, -HOUSE.halfDepth, LAYOUT_TILE, 'the main mass back')
assert.ok(resolved.garage, 'the default layout has a garage')
near(resolved.garage.x0, GARAGE.x0, LAYOUT_TILE, 'the garage left')
near(resolved.garage.x1, GARAGE.x1, LAYOUT_TILE, 'the garage right')
near(resolved.garage.z0, GARAGE.z0, LAYOUT_TILE, 'the garage back')
near(resolved.garage.z1, GARAGE.z1, LAYOUT_TILE, 'the garage front')
assert.equal(resolved.mask.filter(v => v === 1).length, mask.filter(v => v === 1).length, 'the resolved mask is the mass mask')
assert.equal(resolved.regions.length, regions.length, 'the resolved regions are the lot\'s regions')

assert.equal(resolved.layout, layout, 'the resolved layout carries the layout it was resolved from')

const strokeRect = { c0: 0, r0: 0, cols: lot.cols, rows: 6 }
const existingBefore = Array.from(lot.existing)
const proposedBefore = Array.from(lot.proposed)
const inStroke = (i: number) => Math.floor(i / lot.cols) < strokeRect.rows
const paved = applyStroke(layout, strokeRect, { existing: 'pavers', proposed: null })
assert.notEqual(paved, layout, 'a stroke that paints returns a new layout')
assert.equal(paved.source, 'edited', 'a painted layout is edited')
assert.equal(paved.lot.proposed, lot.proposed, 'an existing-only brush leaves the proposed layer alone')
paved.lot.existing.forEach((v, i) => {
  const expected = !inStroke(i) || mask[i] === 1 ? existingBefore[i] : GROUND_MATERIAL_INDEX.pavers
  assert.equal(v, expected, `an existing-only stroke at tile ${i}`)
})
assert.deepEqual(Array.from(lot.existing), existingBefore, 'a stroke never mutates the existing layer it paints')
assert.equal(layout.source, 'default', 'a stroke never mutates the layout it paints')
assert.equal(applyStroke(paved, strokeRect, { existing: 'pavers', proposed: null }), paved, 'painting the same again returns the same layout')
assert.equal(applyStroke(layout, strokeRect, { existing: null, proposed: null }), layout, 'a brush of two No changes returns the same layout')

const turfed = applyStroke(layout, strokeRect, { existing: null, proposed: 'turf' })
assert.equal(turfed.lot.existing, lot.existing, 'a proposed-only brush leaves the existing layer alone')
turfed.lot.proposed.forEach((v, i) => {
  assert.equal(v, inStroke(i) && mask[i] !== 1 ? GROUND_MATERIAL_INDEX.turf : 0, `a proposed-only stroke at tile ${i}`)
})
assert.deepEqual(Array.from(lot.proposed), proposedBefore, 'a stroke never mutates the proposed layer it paints')

const turfedResolved = resolvePropertyLayout(turfed)
const turfRegion = turfedResolved.regions.find(r => r.proposed === 'turf')
assert.ok(turfRegion, 'the turf stroke makes a turf region')
const turfTiles = regionTileIndices(turfedResolved.regions, turfed.lot, turfedResolved.mask, turfedResolved.yards, turfRegion.id)
assert.ok(turfTiles.length > 0, 'the turf region has tiles')
const kept = applyStroke(turfed, turfTiles, { existing: null, proposed: PROPOSED_KEEP })
assert.equal(kept.source, 'edited', 'a region stroke is an edit')
assert.ok(turfTiles.every(i => kept.lot.proposed[i] === 0), 'Keep over a turf region sets its proposed tiles back to 0')
assert.ok(turfTiles.every(i => turfed.lot.proposed[i] === GROUND_MATERIAL_INDEX.turf), 'a tile-list stroke never mutates its input')
assert.equal(kept.lot.existing, turfed.lot.existing, 'a proposed Keep leaves the existing layer alone')
const keptRect = applyStroke(turfed, strokeRect, { existing: null, proposed: PROPOSED_KEEP })
assert.ok(keptRect.lot.proposed.every(v => v === 0), 'Keep over the turf rectangle sets every proposed tile back to 0')
assert.equal(applyStroke(kept, turfTiles, { existing: null, proposed: PROPOSED_KEEP }), kept, 'a no-op tile-list stroke returns the same layout')

const massTile = main.r0 * lot.cols + main.c0
const listed = applyStroke(layout, [massTile, 0], { existing: 'gravel', proposed: null })
assert.equal(listed.lot.existing[massTile], existingBefore[massTile], 'a tile-list stroke skips a mass tile')
assert.equal(listed.lot.existing[0], GROUND_MATERIAL_INDEX.gravel, 'a tile-list stroke paints the tiles it names')
assert.equal(applyStroke(layout, [massTile], { existing: 'gravel', proposed: 'turf' }), layout, 'a tile list of only mass tiles changes nothing')

const overMass = applyStroke(layout, { c0: main.c0 - 1, r0: main.r0 - 1, cols: main.cols + 2, rows: main.rows + 2 }, { existing: 'pool', proposed: 'dg' })
let massTiles = 0
mask.forEach((m, i) => {
  if (m === 1) {
    massTiles++
    assert.equal(overMass.lot.existing[i], existingBefore[i], `a stroke over the house leaves mass tile ${i} existing alone`)
    assert.equal(overMass.lot.proposed[i], proposedBefore[i], `a stroke over the house leaves mass tile ${i} proposed alone`)
  }
})
assert.ok(massTiles > 0, 'the mass check covers mass tiles')
assert.ok(overMass.lot.existing.includes(GROUND_MATERIAL_INDEX.pool), 'the stroke around the house still paints the ring outside it')

const editor = createLayoutEditor()
assert.deepEqual(editor.getState(), { mode: 'orbit', tool: 'ground', pick: { ground: 'concrete', fence: 'woodFence' }, yard: null, selected: null, stroke: null, undo: [] }, 'the editor opens in orbit with a pick for each tool and no stroke')
assert.notEqual(createLayoutEditor(), editor, 'each editor is its own store')
const history = Array.from({ length: 11 }, () => ({ ...layout }))
const undo = history.reduce<readonly typeof layout[]>((stack, each) => pushUndo(stack, each), [])
assert.equal(undo.length, 10, 'pushing 11 layouts keeps 10')
assert.equal(undo[9], history[10], 'the newest layout is kept')
assert.equal(undo[0], history[1], 'the oldest layout is the one dropped')
const inputs = createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout })
commitLayout(inputs, editor, layout)
assert.equal(editor.getState().undo.length, 0, 'committing the same layout pushes no undo')
commitLayout(inputs, editor, paved)
assert.equal(inputs.getState().layout, paved, 'a commit writes the layout to the scene inputs')
assert.deepEqual(editor.getState().undo, [layout], 'a commit pushes the previous layout onto undo')
{
  const rightLine: LineRange = { axis: 'along', line: lot.cols, from: 0, to: lot.rows }
  const vinyl = paintFenceCells(lot.fence.existing, lot, rightLine, K.vinylFence, cellMask)
  const fencedLines = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, existing: vinyl } } }).fences
  const whole = fenceLineAt(fencedLines, 'along', lot.cols, 0)
  assert.ok(whole && whole.from === 0 && whole.to === lot.rows && whole.existing === 'vinylFence', 'a perimeter select writes its whole lot line as one fence line')
  assert.equal(perimeterSideOf(lot, whole), 'right')
  const cleared = paintFenceCells(vinyl, lot, rightLine, FENCE_NONE, cellMask)
  const clearedLines = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, existing: cleared } } }).fences
  assert.ok(!clearedLines.some(f => f.axis === 'along' && f.line === lot.cols), 'None clears the whole lot line')
}

{
  assert.deepEqual(vertexAt(origin, lot, bounds.left - 0.2, bounds.front + 0.2), [0, 0], 'a press just outside the street-side corner snaps to it')
  assert.equal(vertexAt(origin, lot, bounds.left - tile, bounds.front), null, 'a press a whole tile outside snaps to nothing')
  assert.deepEqual(vertexAt(origin, lot, bounds.right + 0.1, bounds.back - 0.1), [lot.cols, lot.rows], 'the far corner is vertex (cols, rows)')
  assert.deepEqual(lineRangeBetween([3, 5], [9, 6]), { axis: 'across', line: 5, from: 3, to: 9 }, 'a mostly sideways drag is an across length on the press row')
  assert.deepEqual(lineRangeBetween([3, 5], [4, 12]), { axis: 'along', line: 3, from: 5, to: 12 }, 'a mostly backward drag is an along length on the press column')
  assert.deepEqual(lineRangeBetween([9, 6], [3, 6]), { axis: 'across', line: 6, from: 3, to: 9 }, 'direction does not matter')
  assert.equal(lineRangeBetween([3, 5], [3, 5]), null, 'no drag, no length')
  const backLineZ = bounds.front - metresOf(lot.rows, tile)
  const backWallLine = fenceLineAt(fences, 'across', lot.rows, 2)
  assert.ok(backWallLine, 'the back wall is a fence line')
  assert.equal(fenceLineNear(origin, lot, fences, bounds.left + 2.5 * tile, backLineZ + 0.05, tile * LINE_TAP_SHARE), backWallLine, 'a point near the back line finds the line through its cell')
  assert.equal(fenceLineNear(origin, lot, fences, bounds.left + 2.5 * tile, backLineZ + tile / 2, tile * LINE_TAP_SHARE), null, 'a point mid-tile finds no line')
  assert.equal(fenceLineNear(origin, lot, fences, bounds.left + 2.5 * tile, bounds.front - metresOf(lot.rows - 4, tile) + 0.05, tile * LINE_TAP_SHARE), null, 'a point near a line that carries no fence finds none')
  const meshReach = tile * FENCE_MESH_TAP_SHARE
  // A hit on a wall lands on either face or on the cap, off the wall's own line by half its thickness or half the cap's width.
  const wallOffsets = [WALL_T / 2, WALL_CAP.width / 2].flatMap(off => [off, -off])
  // Steps through each tile with most points within a quarter tile of the crossing grid line at either end of it.
  const tileSteps = [0, 0.03, 0.08, 0.12, 0.2, 0.25, 0.5, 0.75, 0.8, 0.88, 0.92, 0.97]
  const stepsAlong = (fromCell: number, toCell: number) => Array.from({ length: toCell - fromCell }, (_, n) => tileSteps.map(step => fromCell + n + step)).flat()
  let nearCrossing = 0
  const missed: string[] = []
  // The end tiles are left out: there the other wall's own line is nearer.
  for (const at of stepsAlong(1, lot.cols - 1)) {
    nearCrossing += Math.abs(at - Math.round(at)) <= 0.25 ? 1 : 0
    for (const off of wallOffsets) {
      if (fenceLineNear(origin, lot, fences, origin.originX + metresOf(at, tile), backLineZ + off, meshReach) !== backWallLine) {
        missed.push(`back wall at column ${at.toFixed(2)}, ${off} m off`)
      }
    }
  }
  // Clear of the side-yard fence that meets the left wall, and of the back wall.
  for (const at of [...stepsAlong(0, sideYardRow - 1), ...stepsAlong(sideYardRow + 1, lot.rows - 1)]) {
    nearCrossing += Math.abs(at - Math.round(at)) <= 0.25 ? 1 : 0
    const leftLine = fenceLineAt(fences, 'along', 0, Math.floor(at))
    assert.ok(leftLine, `the left wall carries a line at row ${Math.floor(at)}`)
    for (const off of wallOffsets) {
      if (fenceLineNear(origin, lot, fences, origin.originX + off, bounds.front - metresOf(at, tile), meshReach) !== leftLine) {
        missed.push(`left wall at row ${at.toFixed(2)}, ${off} m off`)
      }
    }
  }
  assert.ok(nearCrossing > 100, `the wall samples sit within a quarter tile of a crossing grid line ${nearCrossing} times`)
  assert.deepEqual(missed, [], `a tap on a wall's face or cap finds that wall's line (${missed.length} missed)`)
  const groundReach = tile * LINE_TAP_SHARE
  assert.equal(fenceLineNear(origin, lot, fences, origin.originX + metresOf(6, tile) + 0.05, backLineZ + 0.12, groundReach), backWallLine, 'a ground tap 0.12 m off the back wall beside a grid vertex finds the wall')
  assert.equal(fenceLineNear(origin, lot, fences, origin.originX + 0.12, bounds.front - metresOf(lot.rows - 6, tile) - 0.05, groundReach), fenceLineAt(fences, 'along', 0, lot.rows - 7), 'a ground tap 0.12 m off the left wall beside a grid vertex finds the wall')
  const leftWallBack = fenceLineAt(fences, 'along', 0, lot.rows - 1)
  assert.equal(fenceLineNear(origin, lot, fences, origin.originX + 0.05, backLineZ + 0.1, groundReach), leftWallBack, 'in the back corner the nearer wall wins: the left')
  assert.equal(fenceLineNear(origin, lot, fences, origin.originX + 0.1, backLineZ + 0.05, groundReach), backWallLine, 'in the back corner the nearer wall wins: the back')
  const fenceEditor = createLayoutEditor()
  assert.equal(fenceEditor.getState().tool, 'ground', 'the brush opens on the ground tool')
  const traced = applyFenceStroke(layout, { axis: 'across', line: lot.rows - 3, from: 2, to: 10 }, { existing: null, proposed: 'vinylFence' })
  assert.notEqual(traced, layout)
  assert.equal(traced.lot.fence.proposed.across[fenceCellIndex(lot, 'across', lot.rows - 3, 5)], K.vinylFence, 'a trace paints the build map')
  assert.equal(traced.lot.fence.existing, lot.fence.existing, 'No change leaves the today map alone')
  assert.equal(traced.lot.existing, lot.existing, 'a fence trace never touches the ground')
  assert.equal(traced.source, 'edited')
  assert.equal(applyFenceStroke(layout, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, { existing: 'woodFence', proposed: null }), layout, 'a trace through the house changes nothing')
  assert.equal(applyFenceStroke(layout, { axis: 'across', line: 3, from: 2, to: 4 }, { existing: null, proposed: null }), layout, 'No change on both rows paints nothing')
  const kept = applyFenceStroke(traced, { axis: 'across', line: lot.rows - 3, from: 2, to: 10 }, { existing: null, proposed: PROPOSED_KEEP })
  assert.deepEqual(Array.from(kept.lot.fence.proposed.across), Array.from(lot.fence.proposed.across), 'Keep erases the build layer')
  const erased = applyFenceStroke(layout, { axis: 'across', line: lot.rows, from: 0, to: lot.cols }, { existing: FENCE_NONE, proposed: null })
  assert.ok(Array.from({ length: lot.cols }, (_, c) => erased.lot.fence.existing.across[fenceCellIndex(lot, 'across', lot.rows, c)]).every(v => v === 0), 'None erases the today layer: the back wall is gone')
  assert.equal(resolvePropertyLayout(erased).fences.length, 5, 'and its line with it')
  const fenceInputs = createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout })
  commitLayout(fenceInputs, fenceEditor, traced)
  const groundAfter = applyStroke(traced, { c0: 2, r0: 2, cols: 2, rows: 2 }, { existing: 'pavers', proposed: null })
  assert.equal(groundAfter.lot.fence, traced.lot.fence, 'a ground stroke after a fence stroke leaves the fence maps untouched')
  assert.equal(fenceEditor.getState().undo.at(-1), layout, 'undo holds the layout before the trace, fence maps included')
  const sameTile = fenceInputs.getState().layout
  commitLayout(fenceInputs, fenceEditor, applyFenceStroke(sameTile, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, { existing: 'woodFence', proposed: null }))
  assert.equal(fenceEditor.getState().undo.length, 1, 'a trace that paints nothing pushes no undo step')
  const outlinesFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-region-outlines.tsx', 'utf8')
  const highlightFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-fence-highlight.tsx', 'utf8')
  assert.ok(!/#[0-9a-f]{6}/i.test(outlinesFile) && !/#[0-9a-f]{6}/i.test(highlightFile) && highlightFile.includes('LAYOUT_EDITOR_LOOK'), 'the editor\'s chrome colours come from LAYOUT_EDITOR_LOOK')
  const previewFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/lot-draw-preview.tsx', 'utf8')
  for (const [name, file] of [['the selected fence\'s highlight', highlightFile], ['the fence trace\'s band', previewFile]] as const) {
    assert.ok(file.includes('depthTest={false}') && /renderOrder=\{[^}]*LAYOUT_EDITOR_LOOK\.fenceOverlayOrder/.test(file), `${name} draws over the fence it lies inside, in the editor look's order`)
  }
  assert.ok(!outlinesFile.includes('depthTest={false}'), 'the region outlines stay depth-tested')
}
const camera = createSceneCamera()
assert.equal(camera.getState().drawing, false, 'the camera opens not drawing')
setSceneCameraDrawing(camera, true)
assert.equal(camera.getState().drawing, true, 'draw mode marks the camera drawing')
setSceneCameraDrawing(camera, false)
assert.equal(camera.getState().drawing, false, 'leaving draw mode clears it')
const rig = readFileSync('src/shared/components/scene/ui/camera-rig.tsx', 'utf8')
assert.ok(rig.includes('useSceneTaps({ enabled: enabled && !drawing'), 'the rig\'s taps stop while drawing')
assert.ok(rig.includes('useCameraWheel({ enabled: enabled && !drawing'), 'the rig\'s wheel stops while drawing')
assert.ok(rig.includes('enabled={!drawing}'), 'the orbit controls stop while drawing')
assert.ok(!rig.includes('useSceneCamera('), 'the rig reads the flag without the hook that throws outside a provider')
const drawHandlers = readFileSync('src/features/trade-scenes/hooks/use-lot-draw-handlers.ts', 'utf8')
const nearestSolidHit = readFileSync('src/features/trade-scenes/ui/lib/nearest-solid-hit.ts', 'utf8')
assert.ok(nearestSolidHit.includes('intersectObjects('), 'the nearest solid hit is decided in one place')
assert.ok(drawHandlers.includes('isNearestSolidHit(') && !drawHandlers.includes('intersectObjects('), 'a press opens a stroke only where the ground is the nearest solid hit')
const labKeys = readFileSync('src/features/trade-scenes/ui/views/property-layout-lab-view.tsx', 'utf8')
assert.ok(labKeys.includes('event.repeat') && labKeys.includes('event.shiftKey'), 'the D toggle ignores key repeat and Shift')

assert.equal(resolved.heightAt(0), 0, 'the pad is level')
near(resolved.heightAt(bounds.front - 1e-9), GRADE.walk, 0.02, 'the front yard falls to the sidewalk')
const curbZ = bounds.front + STREET_BAND.sidewalk + STREET_BAND.parkway
assert.equal(resolved.heightAt(curbZ + STREET_BAND.street / 2), GRADE.street, 'the street\'s middle sits at the street grade')
assert.equal(resolved.groundRows.length, GROUND_ROWS.length, 'the same ground rows as the scene')
resolved.groundRows.forEach(([z, y], i) => {
  const prev = resolved.groundRows[i - 1]
  if (!prev || (y === GRADE.street) === (prev[1] === GRADE.street) || (prev[1] !== GRADE.walk && y !== GRADE.walk)) {
    return
  }
  const nearSide = z < curbZ + STREET_BAND.street / 2
  const [inner, outer] = nearSide ? [curbZ, curbZ + GRADE.curb] : [curbZ + STREET_BAND.street - GRADE.curb, curbZ + STREET_BAND.street]
  assert.ok(prev[0] >= inner - 1e-9 && z <= outer + 1e-9, `the layout ground's step at row ${i} lies within the curb`)
})

const T = LOT.wall.thickness
const padEnd = bounds.front - metresOf(lot.grade.padEndRow, tile)
const sideYardZ = bounds.front - metresOf(sideYardRow, tile)
near(sideYardZ, LOT.gateZ, LAYOUT_TILE, 'the side-yard row lands where the scene\'s side-yard fences stand')
const lowWallParts = padToFront(resolved.heightAt, padEnd, bounds.front, 0, 1, sideYardZ, 1).length
const fenceBoxes = resolved.fenceBoxes.existing
assert.deepEqual(resolved.fenceBoxes.proposed, fenceBoxes, 'with nothing proposed, the build layer shows today\'s fences')
const sameBox = (a: BoxSpec, b: BoxSpec) => a.position.every((v, i) => Math.abs(v - b.position[i]) <= LAYOUT_TILE) && a.size.every((v, i) => Math.abs(v - b.size[i]) <= LAYOUT_TILE)
function matchAll(list: 'blockWalls' | 'wallCaps', label: string) {
  assert.equal(fenceBoxes[list].length, LOT_BOXES[list].length, `${label}: as many as the scene's`)
  for (const [i, was] of LOT_BOXES[list].entries()) {
    assert.ok(fenceBoxes[list].some(now => sameBox(now, was)), `${label} ${i} has a match within a tile`)
  }
}
matchAll('blockWalls', 'block walls')
matchAll('wallCaps', 'wall caps')
const tallWalls = fenceBoxes.blockWalls.filter(wall => Math.abs(wall.size[1] - LOT.wall.height) <= 1e-9)
assert.equal(tallWalls.length, 3, 'three walls stand 1.83 high')
const lowParts = fenceBoxes.blockWalls.filter(wall => wall.size[1] < LOT.frontFence)
assert.equal(lowParts.length, lowWallParts, 'the low wall builds in its slope parts')
for (const wall of lowParts) {
  const cap = fenceBoxes.wallCaps.find(c => Math.abs(c.position[2] - wall.position[2]) <= 1e-6 && Math.abs(c.position[0] - wall.position[0]) <= 1e-6)
  assert.ok(cap, 'every low wall part carries a cap')
  const top = cap.position[1] + cap.size[1] / 2
  assert.ok(top - resolved.heightAt(cap.position[2]) <= LOT.frontFence + 1e-9, `a low wall part stays within 1.07 m, cap included`)
}
// The rail list: today's right side-yard fence has one rail by an accident of the constants; every wood fence now gets two.
assert.equal(fenceBoxes.fenceRails.length, 4, 'two rails on each side-yard fence')
const sceneRails = LOT_BOXES.fenceRails
const matchedRails = sceneRails.map(was => fenceBoxes.fenceRails.find(rail => Math.abs(rail.position[0] - was.position[0]) <= LAYOUT_TILE && Math.abs(rail.position[1] - was.position[1]) <= 1e-6 && Math.abs(rail.position[2] - was.position[2]) <= LAYOUT_TILE))
assert.ok(matchedRails.every(Boolean), 'each of the scene\'s three rails has a match')
const extraRail = fenceBoxes.fenceRails.find(rail => !matchedRails.includes(rail))
assert.ok(extraRail && extraRail.position[0] > GARAGE.x1 && Math.abs(extraRail.position[1] - 0.3) <= 1e-6, 'the one new rail is the right side yard\'s lower rail')
const boardsLeftOf = (list: readonly BoxSpec[]) => list.filter(b => b.position[0] < -HOUSE.halfLength)
const boardsRightOf = (list: readonly BoxSpec[]) => list.filter(b => b.position[0] > GARAGE.x1)
const leftBoards = boardsLeftOf(fenceBoxes.fenceBoards)
const rightBoards = boardsRightOf(fenceBoxes.fenceBoards)
assert.equal(leftBoards.length + rightBoards.length, fenceBoxes.fenceBoards.length, 'every board belongs to a side-yard fence')
assert.equal(leftBoards.length, boards(bounds.left + T / 2, -HOUSE.halfLength, sideYardZ, LOT.wall.height).length, 'the left side-yard fence fills its own length')
assert.equal(rightBoards.length, boards(GARAGE.x1, bounds.right - T / 2, sideYardZ, LOT.wall.height).length, 'the right side-yard fence fills its own length')
assert.ok(Math.abs(leftBoards.length - boardsLeftOf(LOT_BOXES.fenceBoards).length) <= 1, 'the left side-yard fence is within a board of the scene\'s')
assert.ok(Math.abs(rightBoards.length - boardsRightOf(LOT_BOXES.fenceBoards).length) <= 1, 'the right side-yard fence is within a board of the scene\'s')
assert.ok(fenceBoxes.fenceBoards.every(b => b.position[2] === sideYardZ), 'the side-yard boards stand on the side-yard row')
for (const list of ['vinylParts', 'compositeBoards', 'compositePosts', 'ironwork', 'chainPosts', 'chainMesh'] as const) {
  assert.equal(fenceBoxes[list].length, 0, `the default lot builds no ${list}`)
}

assert.equal(boxes.concrete.length, 7, 'six street boxes and the apron')
assert.equal(boxes.asphalt.length, 1, 'one street of asphalt')
const shift = bounds.front - LOT.front
const sceneStreet = LOT_BOXES.concrete.filter(b => b.size[0] > 100)
assert.equal(sceneStreet.length, 6, 'the scene has six street boxes')
for (const [i, was] of [...sceneStreet, ...LOT_BOXES.asphalt].entries()) {
  const now = [...boxes.concrete, ...boxes.asphalt].filter(b => b.size[0] > 100)[i]
  now.size.forEach((v, axis) => near(v, was.size[axis], 1e-9, `street box ${i} size ${axis}`))
  near(now.position[0], was.position[0], 1e-9, `street box ${i} x`)
  near(now.position[1], was.position[1], 1e-9, `street box ${i} y`)
  near(now.position[2], was.position[2] + shift, 1e-9, `street box ${i} z, moved with the front`)
}
// The stoop belongs to the slab foundation, so neither lot draws one under a raised home's steps.
assert.ok(![...LOT_BOXES.concrete, ...boxes.concrete].some(b => b.size[1] === FRONT_STOOP.height), 'neither lot draws the stoop')
let runStart = -1
let runLength = 0
for (let c = 0; c <= lot.cols; c++) {
  if (c < lot.cols && lot.existing[c] === GROUND_MATERIAL_INDEX.concrete) {
    runStart = runStart < 0 ? c : runStart
  }
  else if (runStart >= 0) {
    runLength = Math.max(runLength, c - runStart)
    runStart = -1
  }
}
assert.equal(runLength, 10, 'the driveway meets the street 10 tiles wide')
const aprons = boxes.concrete.filter(b => b.size[0] < 100 && b.position[2] > bounds.front)
assert.equal(aprons.length, 1, 'one apron')
near(aprons[0].size[0], metresOf(runLength, tile) + 1.2, 1e-9, 'the apron is the driveway plus 1.2 m')
near(aprons[0].position[2] - aprons[0].size[2] / 2, bounds.front, 1e-9, 'the apron starts at the lot front')
near(aprons[0].position[2] + aprons[0].size[2] / 2, curbZ + GRADE.curb, 1e-9, 'the apron reaches the curb')

function withPerimeter(side: 'left' | 'right' | 'front', kind: 'blockWall' | 'woodFence') {
  const range: LineRange = side === 'front'
    ? { axis: 'across', line: 0, from: 0, to: lot.cols }
    : { axis: 'along', line: side === 'left' ? 0 : lot.cols, from: 0, to: lot.rows }
  const existing = paintFenceCells(lot.fence.existing, lot, range, K[kind], cellMask)
  return resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, existing } } })
}
for (const kind of ['blockWall', 'woodFence'] as const) {
  const fenced = withPerimeter('front', kind)
  const built = fenced.fenceBoxes.existing
  const onFront = [...built.blockWalls, ...built.wallCaps, ...built.fenceBoards, ...built.fenceRails]
    .filter(b => Math.abs(b.position[2] - fenced.bounds.front) <= 0.1)
  assert.ok(onFront.length > 0, `a front ${kind} builds something on the front`)
  for (const box of onFront) {
    const top = box.position[1] + box.size[1] / 2
    assert.ok(top - fenced.heightAt(box.position[2]) <= LOT.frontFence + 1e-9, `a front ${kind} stands no taller than 42 in (${top - fenced.heightAt(box.position[2])})`)
  }
}
{
  const fenced = withPerimeter('right', 'woodFence')
  const sideBoards = fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[0] === fenced.bounds.right && b.position[2] > padEnd)
  assert.ok(sideBoards.length > 0, 'a whole right woodFence has boards in the front yard')
  for (const board of sideBoards) {
    const bottom = board.position[1] - board.size[1] / 2
    assert.ok(Math.abs(bottom - fenced.heightAt(board.position[2])) <= 0.02, `a side board at z ${board.position[2]} stands on the grade (${bottom})`)
  }
  const sideRails = fenced.fenceBoxes.existing.fenceRails.filter(b => b.size[2] > b.size[0] && b.position[2] > padEnd)
  assert.ok(sideRails.length > 0, 'a whole right woodFence has rails in the front yard')
  // The front yard's rails ride under its 42 in cap.
  for (const rail of sideRails) {
    const above = rail.position[1] - fenced.heightAt(rail.position[2])
    assert.ok([0.3, LOT.frontFence - 0.08].some(y => Math.abs(above - y) <= 0.02), `a side rail at z ${rail.position[2]} follows the grade (${above})`)
  }
}
{
  const walled = withPerimeter('left', 'blockWall')
  const faceZ = walled.bounds.front - metresOf(main.r0, tile)
  const inFront = walled.fenceBoxes.existing.blockWalls.filter(b => b.position[2] > faceZ && b.position[2] <= walled.bounds.front)
  assert.ok(inFront.length > 0, 'a whole left blockWall has parts in the front yard')
  for (const wall of inFront) {
    const cap = walled.fenceBoxes.existing.wallCaps.find(c => Math.abs(c.position[2] - wall.position[2]) <= 1e-6)
    assert.ok(cap && cap.position[1] + cap.size[1] / 2 - walled.heightAt(cap.position[2]) <= LOT.frontFence + 1e-9, `the front-yard stretch builds low at z ${wall.position[2]}`)
  }
  const behind = walled.fenceBoxes.existing.blockWalls.filter(b => b.position[2] < faceZ)
  assert.ok(behind.length > 0 && behind.every(b => Math.abs(b.size[1] - LOT.wall.height) <= 1e-9), 'the stretch behind the face stands 1.83')
  for (const wall of walled.fenceBoxes.existing.blockWalls) {
    const bottom = wall.position[1] - wall.size[1] / 2
    assert.ok(bottom - walled.heightAt(wall.position[2]) <= 0.05, `no wall part floats over the grade (z ${wall.position[2]}, ${bottom})`)
  }
  const fenced = withPerimeter('left', 'woodFence')
  const boardTop = (b: BoxSpec) => b.position[1] + b.size[1] / 2 - fenced.heightAt(b.position[2])
  assert.ok(fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[2] > faceZ).every(b => boardTop(b) <= LOT.frontFence + 1e-9), 'front-yard boards stop at 42 in')
  assert.ok(fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[2] < faceZ).every(b => Math.abs(boardTop(b) - LOT.wall.height) <= 0.02), 'boards behind the face stand 6 ft')
}
{
  const fenced = withPerimeter('front', 'woodFence')
  const frontBoards = fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[2] === fenced.bounds.front)
  assert.ok(frontBoards.length > 0, 'a front woodFence has boards')
  for (const board of frontBoards) {
    near(board.position[1] - board.size[1] / 2, fenced.heightAt(fenced.bounds.front), 0.02, 'a front board stands on the ground at the front')
  }
}

function withExisting(axis: FenceAxis, line: number, from: number, to: number, kind: FenceKindId, layer: GroundLayer = 'existing') {
  const map = paintFenceCells(lot.fence[layer], lot, { axis, line, from, to }, FENCE_KIND_INDEX[kind], cellMask)
  const r = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, [layer]: map } } })
  return { r, boxes: r.fenceBoxes[layer] }
}
const backRow = lot.rows - 3
const listOf: Record<FenceKindId, (keyof FenceBoxes)[]> = { woodFence: ['fenceBoards', 'fenceRails'], vinylFence: ['vinylParts'], compositeFence: ['compositeBoards', 'compositePosts'], wroughtIron: ['ironwork'], chainLink: ['chainPosts', 'chainMesh'], blockWall: ['blockWalls', 'wallCaps'], lowWall: ['blockWalls', 'wallCaps'], woodGate: ['fenceBoards', 'fenceRails'], vinylGate: ['vinylParts'], compositeGate: ['compositeBoards', 'compositePosts'], ironGate: ['ironwork'] }
const topOf = (boxes: readonly BoxSpec[], heightAt: (z: number) => number) => Math.max(...boxes.map(box => box.position[1] + box.size[1] / 2 - heightAt(box.position[2])))
for (const kind of FENCE_KIND_IDS) {
  const { r, boxes: b } = withExisting('across', backRow, 2, 10, kind)
  const drawn = listOf[kind].flatMap(list => b[list]).filter(box => Math.abs(box.position[2] - (r.bounds.front - metresOf(backRow, tile))) < 0.2)
  assert.ok(drawn.length > 0, `${kind} across the back yard draws in its own lists`)
  const expectedHeight = kind === 'lowWall' ? LOT.frontFence : LOT.wall.height
  const top = topOf(drawn, r.heightAt)
  assert.ok(top >= expectedHeight - 0.02 && top <= expectedHeight + 0.08 + 1e-9, `${kind} stands at its height in the back yard, posts carrying at most 0.08 (${top})`)
  const untouched = (Object.keys(b) as (keyof FenceBoxes)[]).filter(list => !listOf[kind].includes(list))
  assert.ok(untouched.every(list => b[list].length === fenceBoxes[list].length), `${kind} adds boxes to no other list`)
  const front = withExisting('across', 0, 2, 10, kind)
  const onFront = listOf[kind].flatMap(list => front.boxes[list]).filter(box => Math.abs(box.position[2] - front.r.bounds.front) < 0.2)
  assert.ok(onFront.length > 0, `${kind} on the front line draws`)
  assert.ok(topOf(onFront, front.r.heightAt) <= LOT.frontFence + 0.08 + 1e-9, `${kind} on the front stands no taller than 42 in, posts carrying at most 0.08`)
}
assert.equal(withExisting('across', 0, 2, 10, 'blockWall').boxes.blockWalls.filter(b => Math.abs(b.position[2] - bounds.front) < 0.2).every(b => b.size[1] <= LOT.frontFence), true, 'a block wall on the front builds low')
{
  const single = withExisting('across', backRow, 4, 6, 'woodGate').boxes
  const double = withExisting('across', backRow, 4, 9, 'woodGate').boxes
  const stiles = (b: FenceBoxes) => b.fenceRails.filter(box => Math.abs(box.position[2] - (bounds.front - metresOf(backRow, tile))) < 0.2 && box.size[1] > 1 && box.size[0] < 0.1).length
  assert.equal(stiles(single), 2, 'a two-cell gate is one leaf: two stiles')
  assert.equal(stiles(double), 4, 'a five-cell gate is two leaves: four stiles')
  const { r: sloped, boxes: slopedGate } = withExisting('along', 3, 1, 6, 'ironGate')
  const leafParts = slopedGate.ironwork.filter(box => box.size[0] < 0.1)
  assert.ok(leafParts.length > 0, 'a gate down the front yard\'s slope draws its leaves')
  const clearance = Math.min(...leafParts.flatMap(box => [-1, 0, 1].map(end => box.position[1] - box.size[1] / 2 - sloped.heightAt(box.position[2] + end * box.size[2] / 2))))
  assert.ok(clearance >= 0.05 - 1e-6, `a gate leaf on the slope keeps its clearance above the grade along its whole length (${clearance})`)
}
{
  const from = main.r0 + main.rows + 2
  const { r, boxes: b } = withExisting('along', 10, from, lot.rows, 'vinylFence')
  const zNear = r.bounds.front - metresOf(from, tile)
  const zFar = r.bounds.front - metresOf(lot.rows, tile)
  const standing = b.vinylParts.filter(box => box.size[1] > 0.5)
  assert.ok(standing.length > 0, 'posts and panels are the tall vinyl parts')
  for (const box of standing) {
    assert.ok(box.position[1] - box.size[1] / 2 - r.heightAt(box.position[2]) <= 0.06, `a vinyl part at z ${box.position[2]} stands on the grade`)
  }
  for (const box of b.vinylParts) {
    assert.ok(box.position[2] - box.size[2] / 2 >= zFar - 0.1 && box.position[2] + box.size[2] / 2 <= zNear + 0.1, `a vinyl part at z ${box.position[2]} stays between the drawn ends`)
  }
  const toHouse = withExisting('along', main.c0 + 2, main.r0 + main.rows, lot.rows, 'vinylFence').boxes.vinylParts
  near(Math.max(...toHouse.map(box => box.position[2] + box.size[2] / 2)), -HOUSE.halfDepth, 0.1, 'a fence traced up to the house\'s back face ends on that face')
}
{
  const { r } = withExisting('along', 10, main.r0 + main.rows + 2, lot.rows, 'compositeFence', 'proposed')
  assert.deepEqual(r.fenceBoxes.existing, fenceBoxes, 'a proposed fence leaves the today view\'s boxes unchanged')
  assert.ok(r.fenceBoxes.proposed.compositeBoards.length > 0, 'and shows in the build view')
  assert.equal(r.fenceBoxes.proposed.blockWalls.length, fenceBoxes.blockWalls.length, 'the build view keeps today\'s walls where nothing is proposed')
}
{
  const [from, to] = [4, 10]
  const { r } = withExisting('across', lot.rows, from, to, 'vinylFence', 'proposed')
  assert.deepEqual(r.fenceBoxes.existing, fenceBoxes, 'a kind proposed over today\'s wall leaves the today view\'s boxes unchanged')
  const backZ = r.bounds.front - metresOf(lot.rows, tile)
  const [x0, x1] = [r.origin.originX + metresOf(from, tile), r.origin.originX + metresOf(to, tile)]
  const onBack = (box: BoxSpec) => Math.abs(box.position[2] - backZ) < 0.2 && box.size[0] > box.size[2]
  const xSpan = (box: BoxSpec) => [box.position[0] - box.size[0] / 2, box.position[0] + box.size[0] / 2]
  const vinyl = r.fenceBoxes.proposed.vinylParts.filter(box => Math.abs(box.position[2] - backZ) < 0.2)
  // A post's cap is wider than the post, so it may overhang the drawn end by a couple of centimetres.
  assert.ok(vinyl.length > 0 && vinyl.every(box => xSpan(box)[0] >= x0 - 0.03 && xSpan(box)[1] <= x1 + 0.03), 'the build view shows the proposed vinyl on the cells it was painted on')
  const backWalls = r.fenceBoxes.proposed.blockWalls.filter(onBack)
  assert.ok(backWalls.every(box => xSpan(box)[1] <= x0 + 1e-6 || xSpan(box)[0] >= x1 - 1e-6), 'the build view shows no wall where the vinyl replaces it')
  assert.ok(backWalls.some(box => xSpan(box)[1] <= x0 + 1e-6) && backWalls.some(box => xSpan(box)[0] >= x1 - 1e-6), 'and today\'s wall either side of it on the same line')
}
assert.ok(withExisting('across', backRow, 2, 10, 'chainLink').boxes.chainMesh.length === 1, 'chain link is one mesh plane per line')
const lotFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx', 'utf8')
assert.ok(lotFile.includes('FENCE_BOX_LOOKS') && !/color="#/.test(lotFile), 'the fence groups mount from one look table with palette colours')

assert.deepEqual(tileAt(origin, lot, -8.3, 9.9), [0, 0], 'the lot\'s street-side left corner is tile (0, 0)')
assert.equal(tileAt(origin, lot, bounds.left - 0.01, 0), null, 'left of the lot is outside')
assert.equal(tileAt(origin, lot, 0, bounds.front + 0.01), null, 'past the front is outside')
assert.equal(tileAt(origin, lot, bounds.right, 0), null, 'the right edge itself is outside')
assert.equal(tileAt(origin, lot, 0, bounds.back), null, 'the back edge itself is outside')
assert.deepEqual(tileAt(origin, lot, bounds.right - 1e-6, bounds.back + 1e-6), [lot.cols - 1, lot.rows - 1], 'just inside the far corner is the last tile')
const mainWorld = worldRectOf(origin, main)
assert.deepEqual(mainWorld, resolved.main, 'the main rect is the main mass in the world')
assert.deepEqual(tileAt(origin, lot, mainWorld.x0 + 1e-6, mainWorld.z1 - 1e-6), [main.c0, main.r0], 'the main rect\'s front-left corner is the mass\'s first tile')
const centre = tileAt(origin, lot, (mainWorld.x0 + mainWorld.x1) / 2, (mainWorld.z0 + mainWorld.z1) / 2)
assert.ok(centre && centre[0] >= main.c0 && centre[0] < main.c0 + main.cols && centre[1] >= main.r0 && centre[1] < main.r0 + main.rows, 'the main rect\'s centre lies on the main mass')

assert.ok(
  readFileSync('src/features/trade-scenes/ui/views/trade-scene-view.tsx', 'utf8').includes('inputs ?? createSceneInputs(HOME_SCENE_DEFAULTS)'),
  'the trade scene takes a store from outside and seeds its own otherwise',
)
const labView = readFileSync('src/features/trade-scenes/ui/views/property-layout-lab-view.tsx', 'utf8')
for (const token of ['LotSlotContext', 'ResolvedLayoutProvider', 'useQueryState', 'dynamic(']) {
  assert.ok(labView.includes(token), `the lab view uses ${token}`)
}
assert.ok(!readFileSync('src/features/trade-scenes/constants/property-layout-query-parsers.ts', 'utf8').includes('throttleMs'), 'the URL parser uses nuqs\'s current throttle option')
assert.equal(propertyLayoutParser.parse('not json'), null, 'the URL parser rejects a value that is not a layout')
assert.deepEqual(propertyLayoutParser.parse(propertyLayoutParser.serialize(DEFAULT_LAYOUT)), DEFAULT_LAYOUT, 'a layout survives the URL')
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}
const misnamed = filesUnder('src/features/trade-scenes').filter(path => readFileSync(path, 'utf8').includes('SceneLayoutLab'))
assert.deepEqual(misnamed, [], 'the lab goes by the glossary name')

assert.equal(formatFeet(3.6576), '12 ft', 'twelve feet, rounded')
assert.equal(formatSquareFeet(115.2), '1,240 sq ft', 'square feet, grouped')
assert.deepEqual(Object.keys(LAYOUT_EDITOR_COPY).sort(), ['draw', 'layout'], 'the draw bar\'s and the panel\'s copy')
const viewLabels: readonly string[] = Object.values(SCENE_VIEW_LABELS)
let copyChecked = 0
for (const [section, lines] of Object.entries(LAYOUT_EDITOR_COPY)) {
  for (const [key, line] of Object.entries(lines)) {
    copyChecked++
    assert.ok(typeof line === 'string' && line.length > 0, `${section}.${key} is a non-empty string`)
    assert.ok(!viewLabels.includes(line), `${section}.${key} does not restate a view label`)
  }
}
assert.ok(copyChecked >= 5, 'the copy loop covers every line')
const copySource = readFileSync('src/features/trade-scenes/constants/layout-editor-copy.ts', 'utf8')
assert.ok(!copySource.includes(`'${SCENE_VIEW_LABELS.existing}'`) && !copySource.includes(`'${SCENE_VIEW_LABELS.proposed}'`), 'the panel\'s copy holds no view label of its own')
const editorDir = 'src/features/trade-scenes/ui/components/layout-editor'
const measurers = filesUnder('src/features/trade-scenes').filter(path => /\bregion(?:PerimeterM|AreaM2)\b/.test(readFileSync(path, 'utf8'))).sort()
assert.deepEqual(measurers, ['src/features/trade-scenes/ui/components/controls/yard-selection-body.tsx', 'src/features/trade-scenes/lib/lot-regions.ts'].sort(), 'a region\'s perimeter and area are shown, never passed on')
assert.deepEqual([...perimeterKindsFor('front')], FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('existing') && !FENCE_KINDS[id].gate && id !== 'blockWall'), 'the front offers every today kind but gates and the block wall')
assert.deepEqual([...perimeterKindsFor('left')], FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('existing') && !FENCE_KINDS[id].gate), 'a side offers every today kind but gates')
const perimeterFields = readFileSync('src/features/trade-scenes/ui/components/controls/lot-perimeter-fields.tsx', 'utf8')
assert.ok(perimeterFields.includes('perimeterKindsFor(') && perimeterFields.includes('className="dark"'), 'the perimeter selects take their kinds from the rule and open in the scoped dark')
assert.ok(!readdirSync(editorDir).some(name => name.includes('edges')), 'the old per-side fence fields are gone')
assert.ok(labView.includes('<LayoutEditorPanel'), 'the lab view mounts the editor panel')
const editorPanel = readFileSync(`${editorDir}/layout-editor-panel.tsx`, 'utf8')
assert.ok(!/\bfixed\b/.test(editorPanel) && !/\bfixed\b/.test(labView), 'the panel and the badge are placed in the stage\'s box, never against the window')
assert.ok(editorPanel.includes('\'dark absolute'), 'the panel carries the stage\'s scoped dark')
assert.ok(!editorPanel.includes('useMediaQuery'), 'the panel\'s shape comes from the stage\'s width, not the viewport')
assert.ok(labView.includes('useStageSize(frame)') && labView.includes('className="relative h-full"'), 'the lab view measures the box the panel and the stage share')
const fenceMeasurers = filesUnder('src/features/trade-scenes').filter(path => /\bfenceLengthM\b/.test(readFileSync(path, 'utf8'))).sort()
assert.deepEqual(fenceMeasurers, ['src/features/trade-scenes/ui/components/controls/yard-selection-body.tsx', 'src/features/trade-scenes/lib/lot-fences.ts'].sort(), 'a fence line\'s length is shown, never passed on')

{
  const fenceMask = cellMask
  assert.equal(yardOfTile(main, 0, 0), 'front-yard')
  assert.equal(yardOfTile(main, 0, main.r0 - 1), 'front-yard')
  assert.equal(yardOfTile(main, 0, main.r0), 'left-side-yard')
  assert.equal(yardOfTile(main, main.c0 + main.cols, main.r0), 'right-side-yard')
  assert.equal(yardOfTile(main, 0, main.r0 + main.rows), 'back-yard')
  const yards = yardMap(DEFAULT_LAYOUT)
  assert.equal(yards[main.r0 * lot.cols + main.c0], -1, 'a tile under the house is in no yard')
  assert.deepEqual(presentYards(yards), YARD_IDS)
  assert.equal(YARD_IDS.reduce((n, yard) => n + yardTileIndices(yards, yard).length, 0), yards.filter(v => v !== -1).length)
  // The front yard's lot lines: the whole front line, and the side lines only as far back as the house face.
  const frontCells = yardLotLineCells(lot, yards, 'front-yard')
  assert.equal(frontCells.find(c => c.axis === 'across')!.indices.length, lot.cols)
  assert.equal(frontCells.find(c => c.axis === 'along')!.indices.length, main.r0 * 2)
  assert.ok(yardLotLineCells(lot, yards, 'back-yard').every(c => c.indices.every(i => fenceMask[c.axis][i] === 0)), 'no lot-line cell is ever masked')
  // A house built to the left lot line leaves no left side yard.
  const flush = { ...DEFAULT_LAYOUT, house: { ...DEFAULT_LAYOUT.house, masses: DEFAULT_LAYOUT.house.masses.map(m => m.role === 'main' ? { ...m, cols: m.cols + m.c0, c0: 0 } : m) } }
  assert.ok(!presentYards(yardMap(flush)).includes('left-side-yard'))
  for (const id of GROUND_MATERIAL_IDS) {
    assert.equal(GROUND_MATERIALS[id].wears, id !== 'dirt' && id !== 'pool')
    assert.equal(GROUND_MATERIALS[id].system, id === 'pool' ? null : ['concrete', 'pavers', 'asphalt'].includes(id) ? 'hardscaping' : 'landscaping')
  }
  const good = GROUND_WEAR_INDEX.good
  assert.ok(DEFAULT_LAYOUT.lot.wear.every((w, i) => w === (yards[i] === -1 ? w : good)), 'every yard tile of the default lot is Good')
  assert.deepEqual(DEFAULT_LAYOUT.lot.bases['back-yard'], { material: 'sod', wear: 'good', appearance: 0 })
  // Regions stop at the yard line, and say which yard and whether they are base.
  const yardRegions = lotRegions(lot, mask, yards)
  for (const region of yardRegions) {
    const tiles = regionTileIndices(yardRegions, lot, mask, yards, region.id)
    assert.ok(tiles.every(i => YARD_IDS[yards[i]] === region.yard), `region ${region.id} sits in one yard`)
  }
  assert.ok(yardRegions.some(r => r.existing === 'sod' && r.base && r.yard === 'back-yard'))
  assert.ok(yardRegions.filter(r => r.existing === 'mulch').every(r => !r.base && r.wear === 'good'))
  assert.equal(yardRegions.filter(r => r.existing === 'mulch').reduce((n, r) => n + r.tiles, 0), lot.existing.filter((v, i) => v === GROUND_MATERIAL_INDEX.mulch && yards[i] !== -1).length, 'splitting a bed at the yard line loses no tile')
  // Wear splits a region; dirt carries none.
  const back = yardTileIndices(yards, 'back-yard')
  const worn = applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: null, proposed: null, wear: 'worn' })
  assert.equal(worn.lot.wear[back[0]], GROUND_WEAR_INDEX.worn)
  assert.equal(lotRegions(worn.lot, mask, yards).filter(r => r.yard === 'back-yard' && r.existing === 'sod').length, 2)
  const dirt = applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'dirt', proposed: null })
  assert.equal(dirt.lot.wear[back[0]], GROUND_WEAR_NONE)
  assert.equal(applyStroke(dirt, back.slice(0, 2), { existing: null, proposed: null, wear: 'worn' }), dirt, 'wear on dirt changes nothing')
  // Back to base across two yards writes each tile its own yard's base.
  const twoBases = { ...dirt, lot: { ...dirt.lot, bases: { ...dirt.lot.bases, 'left-side-yard': { material: 'concrete', wear: 'fair', appearance: 0 } } } } as PropertyLayout
  const left = yardTileIndices(yards, 'left-side-yard')
  const erased = applyStroke(twoBases, [back[0], left[0]], { existing: GROUND_BASE, proposed: null })
  assert.equal(erased.lot.existing[back[0]], GROUND_MATERIAL_INDEX.sod)
  assert.equal(erased.lot.existing[left[0]], GROUND_MATERIAL_INDEX.concrete)
  assert.equal(erased.lot.wear[left[0]], GROUND_WEAR_INDEX.fair)
  // Wire round trip, and a v2 link.
  const text = encodePropertyLayout(worn)
  assert.equal(JSON.parse(text)._v, 4)
  assert.deepEqual(decodePropertyLayout(text, worn.tile), worn)
  const asV2 = (layout: PropertyLayout) => {
    const w = JSON.parse(encodePropertyLayout(layout))
    w._v = 2
    delete w.lot.wear
    delete w.lot.bases
    delete w.lot.appearance
    return JSON.stringify(w)
  }
  const v2 = JSON.parse(encodePropertyLayout(dirt))
  v2._v = 2
  delete v2.lot.wear
  delete v2.lot.bases
  delete v2.lot.appearance
  const old = decodePropertyLayout(JSON.stringify(v2), dirt.tile)!
  assert.deepEqual(old.lot.existing, dirt.lot.existing)
  assert.deepEqual(old.lot.proposed, dirt.lot.proposed)
  assert.deepEqual(old.lot.fence, dirt.lot.fence)
  assert.equal(old.lot.wear[back[2]], good)
  assert.equal(old.lot.wear[back[0]], GROUND_WEAR_NONE, 'old dirt carries no wear')
  assert.deepEqual(old.lot.bases['back-yard'], { material: 'sod', wear: 'good', appearance: 0 })
  assert.deepEqual(decodePropertyLayout(encodePropertyLayout(old), old.tile), old)
  assert.deepEqual(decodePropertyLayout(asV2(DEFAULT_LAYOUT), DEFAULT_LAYOUT.tile), DEFAULT_LAYOUT, 'an old link to the default lot is the default lot')
  const pooled = applyStroke(DEFAULT_LAYOUT, back, { existing: 'pool', proposed: null })
  assert.deepEqual(decodePropertyLayout(asV2(pooled), pooled.tile)!.lot.bases['back-yard'], { material: 'sod', wear: 'good', appearance: 0 }, 'pool is never a base')
  const badBase = JSON.parse(text)
  badBase.lot.bases['back-yard'].m = GROUND_MATERIAL_INDEX.pool
  assert.equal(decodePropertyLayout(JSON.stringify(badBase), worn.tile), null, 'a pool base is refused')
  // Re-tile carries wear.
  assert.equal(retilePropertyLayout(worn, worn.tile / 2).lot.wear.length, worn.lot.wear.length * 4)
  // A yard chip acts on the whole yard's share of a system, base included.
  const turf = setYardBuild(DEFAULT_LAYOUT, 'back-yard', 'landscaping', { material: 'turf' })
  assert.deepEqual(yardGroundBuild(turf.lot, yards, 'back-yard', 'landscaping'), { material: 'turf', appearance: 0 })
  assert.equal(yardGroundBuild(turf.lot, yards, 'front-yard', 'landscaping'), null, 'a back yard pick leaves the front yard alone')
  assert.deepEqual(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'front-yard', 'landscaping'), { material: 'mixed', wear: 'good', appearance: 0 }, 'lawn and mulch')
  assert.deepEqual(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'front-yard', 'hardscaping'), { material: 'concrete', wear: 'good', appearance: 0 })
  assert.equal(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'back-yard', 'hardscaping'), null)
  assert.ok(yardBuildChanges(turf, yards, 'back-yard') && !yardBuildChanges(turf, yards, 'front-yard'))
  const halfPavers = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: null, proposed: 'pavers' })
  assert.deepEqual(yardGroundBuild(halfPavers.lot, yards, 'back-yard', 'landscaping'), { material: 'mixed', appearance: 0 })
  assert.deepEqual(yardGroundBuild(applyStroke(DEFAULT_LAYOUT, back, { existing: null, proposed: 'pavers' }).lot, yards, 'back-yard', 'landscaping'), { material: 'pavers', appearance: 0 })
  const wornLawn = setYardGround(DEFAULT_LAYOUT, 'back-yard', 'landscaping', { wear: 'worn' })
  assert.deepEqual(wornLawn.lot.bases['back-yard'], { material: 'sod', wear: 'worn', appearance: 0 })
  assert.ok(lotRegions(wornLawn.lot, mask, yards).filter(r => r.yard === 'back-yard').every(r => r.base))
  const patio = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: 'concrete', proposed: null, wear: 'fair' })
  const gravel = setYardBase(patio, 'back-yard', { material: 'gravel' })
  assert.equal(gravel.lot.existing[back[0]], GROUND_MATERIAL_INDEX.concrete)
  assert.equal(gravel.lot.wear[back[0]], GROUND_WEAR_INDEX.fair)
  assert.equal(gravel.lot.existing[back[10]], GROUND_MATERIAL_INDEX.gravel)
  const absorbed = setYardBase(patio, 'back-yard', { material: 'concrete', wear: 'fair' })
  assert.ok(lotRegions(absorbed.lot, mask, yards).filter(r => r.yard === 'back-yard').every(r => r.base), 'a region equal to the new base is base')
  const pavedBack = applyStroke(DEFAULT_LAYOUT, back, { existing: 'pavers', proposed: null })
  const stored = setYardBase(pavedBack, 'back-yard', { material: 'dirt' })
  assert.deepEqual(stored.lot.existing, pavedBack.lot.existing, 'a yard wholly drawn over repaints nothing')
  assert.deepEqual(stored.lot.bases['back-yard'], { material: 'dirt', wear: null, appearance: 0 })
  const built = applyStroke(patio, back.slice(0, 4), { existing: null, proposed: 'pavers' })
  const removed = removeRegion(built, back.slice(0, 4))
  assert.equal(removed.lot.existing[back[0]], GROUND_MATERIAL_INDEX.sod)
  assert.equal(removed.lot.proposed[back[0]], PROPOSED_KEEP)
  assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'back-yard', 'existing'), 'blockWall')
  assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'back-yard', 'proposed'), null)
  assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'left-side-yard', 'existing'), 'mixed', 'the default left lot line holds a low wall and a block wall')
  assert.ok(!perimeterKindsFor('front', 'existing').includes('blockWall') && perimeterKindsFor('back', 'existing').includes('blockWall'))
  assert.ok(perimeterKindsFor('back', 'proposed').every(id => !FENCE_KINDS[id].gate && FENCE_KINDS[id].sets.includes('proposed')))
  assert.deepEqual([...perimeterKindsFor('front')], [...perimeterKindsFor('front', 'existing')], 'the old one-argument call keeps its answer')
  const backCells = yardLotLineCells(lot, yards, 'back-yard')
  const bare = removeFenceLine(removeFenceLine(DEFAULT_LAYOUT, lotFenceLines(DEFAULT_LAYOUT, fenceMask).find(l => l.axis === 'across' && l.existing === 'blockWall')!), lotFenceLines(DEFAULT_LAYOUT, fenceMask).find(l => l.axis === 'along' && l.line === lot.cols)!)
  assert.equal(yardFence(bare, yards, 'right-side-yard', 'existing'), null)
  const fencedRight = setYardFence(bare, 'right-side-yard', 'existing', 'woodFence')
  assert.ok(yardLotLineCells(lot, yards, 'right-side-yard').every(c => c.indices.every(i => fencedRight.lot.fence.existing[c.axis][i] === FENCE_KIND_INDEX.woodFence)))
  const acrossBack = backCells.find(c => c.axis === 'across')!.indices
  const gated = applyFenceStroke(DEFAULT_LAYOUT, { axis: 'across', indices: acrossBack.slice(0, 2) }, { existing: 'woodGate', proposed: null })
  const vinyl = setYardFence(gated, 'back-yard', 'proposed', 'vinylFence')
  assert.equal(vinyl.lot.fence.proposed.across[acrossBack[0]], 0, 'the gate is left alone')
  assert.equal(vinyl.lot.fence.proposed.across[acrossBack[2]], FENCE_KIND_INDEX.vinylFence)
  const untouched = [...vinyl.lot.fence.proposed.across].filter((v, i) => v !== 0 && !acrossBack.includes(i)).length
  assert.equal(untouched, 0, 'no across cell off the back yard\'s lot line is written')
  const fenceLine = lotFenceLines(vinyl, fenceMask).find(l => l.proposed === 'vinylFence')!
  const gone = removeFenceLine(vinyl, fenceLine)
  assert.ok(fenceLineCells(fenceLine, lot).every(i => gone.lot.fence.existing[fenceLine.axis][i] === 0 && gone.lot.fence.proposed[fenceLine.axis][i] === 0))
  assert.equal(setYardBuild(flush, 'left-side-yard', 'landscaping', { material: 'turf' }), flush)
  assert.equal(setYardFence(flush, 'left-side-yard', 'existing', 'woodFence'), flush)
  assert.equal(setYardBase(flush, 'left-side-yard', { material: 'gravel' }), flush)
  assert.equal(setYardGround(flush, 'left-side-yard', 'landscaping', { wear: 'worn' }), flush)
  // A tap on the lot opens the yard it lands in, on the one thing it names.
  const resolvedDefault = resolvePropertyLayout(DEFAULT_LAYOUT)
  const lawnTile = [back[0] % lot.cols, Math.floor(back[0] / lot.cols)] as const
  assert.deepEqual(lotTapTarget({ tile: lawnTile, fenceId: null }, resolvedDefault), { yard: 'back-yard', selected: null }, 'base ground opens the yard, unfocused')
  assert.equal(lotTapTarget({ tile: null, fenceId: null }, resolvedDefault), null, 'off the lot')
  assert.equal(lotTapTarget({ tile: [main.c0, main.r0], fenceId: null }, resolvedDefault), null, 'under the house')
  const mulchRegion = resolvedDefault.regions.find(r => r.existing === 'mulch')!
  const mulchTile = [mulchRegion.bbox.c0, mulchRegion.bbox.r0] as const
  assert.deepEqual(lotTapTarget({ tile: mulchTile, fenceId: null }, resolvedDefault), { yard: mulchRegion.yard, selected: { type: 'region', id: mulchRegion.id } })
  const wall = resolvedDefault.fences.find(f => f.existing === 'blockWall' && f.axis === 'across')!
  assert.deepEqual(lotTapTarget({ tile: [1, lot.rows - 1], fenceId: wall.id }, resolvedDefault), { yard: 'back-yard', selected: { type: 'fence', id: wall.id } }, 'a fence tap is the fence, not the ground under it')
  const resolvedTurf = resolvePropertyLayout(applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: null, proposed: 'turf' }))
  assert.equal(lotTapTarget({ tile: lawnTile, fenceId: null }, resolvedTurf)!.selected?.type, 'region', 'base ground the build changes can be opened and removed')
  // The selection card follows its region after a write the way a tap would find it, so ground painted back to the yard's base lets the selection go.
  const mulchTiles = regionTileIndices(resolvedDefault.regions, lot, resolvedDefault.mask, resolvedDefault.yards, mulchRegion.id)
  assert.equal(regionSelectionAt(applyStroke(DEFAULT_LAYOUT, mulchTiles, { existing: 'sod', proposed: null, wear: 'good' }), Number(mulchRegion.id)), null, 'mulch painted to sod at Good is the yard again')
  assert.equal(regionSelectionAt(applyStroke(DEFAULT_LAYOUT, mulchTiles, { existing: 'sod', proposed: 'turf', wear: 'good' }), Number(mulchRegion.id))?.type, 'region', 'base ground the build changes stays focused')
  // A fence mesh's tap takes the yard on the side the hit lands; a lot line has a yard on one side only.
  const tapOrigin = resolvedDefault.origin
  const wallX = tapOrigin.originX + (wall.from + 0.5) * tapOrigin.tile
  assert.deepEqual(fenceTapTile(tapOrigin, lot, yards, wall, wallX, tapOrigin.frontZ - (wall.line - 0.2) * tapOrigin.tile), [wall.from, lot.rows - 1], 'the hit inside the lot line')
  assert.deepEqual(fenceTapTile(tapOrigin, lot, yards, wall, wallX, tapOrigin.frontZ - (wall.line + 0.2) * tapOrigin.tile), [wall.from, lot.rows - 1], 'a hit past the lot line still finds the yard')
  // The scene's two tap handlers and the selection card.
  const lotTaps = readFileSync('src/features/trade-scenes/hooks/use-lot-tap-handlers.ts', 'utf8')
  assert.ok(lotTaps.includes('isNearestSolidHit(') && !lotTaps.includes('intersectObjects('), 'a lot tap counts only where the ground or the fence is the nearest solid hit')
  assert.ok(lotTaps.includes('fenceLineNear(') && !lotTaps.includes('fenceLineAt('), 'a mesh tap and a ground tap find their fence line through the one shared rule')
  assert.ok(lotTaps.includes('FENCE_MESH_TAP_SHARE') && lotTaps.includes('LINE_TAP_SHARE') && lotTaps.includes('event.stopPropagation()'), 'the fence\'s tap is the fence\'s, never the ground\'s under it')
  assert.ok(lotTaps.includes('claimTap()') && lotTaps.includes('onClick') && !lotTaps.includes('onPointerDown'), 'a tap claims itself on the click')
  assert.ok(lotTaps.includes('event.delta > SCENE_MOTION.tapSlopPx'), 'a dragged click is not a tap: R3F runs onClick however far the press travelled')
  assert.ok(lotTaps.includes('open === \'systems\'') && lotTaps.includes('group === \'lot\'') && lotTaps.includes('mode === \'orbit\''), 'a lot tap acts only while Areas is open on the Lot group, outside drawing')
  assert.ok(lotFile.includes('useLotTapHandlers(') && !lotFile.includes('useFenceTapHandlers'), 'the lot mounts the tap handlers')
  assert.ok(!existsSync('src/features/trade-scenes/hooks/use-fence-tap-handlers.ts'), 'the draw-mode fence tap is gone')
  assert.ok(['region-card.tsx', 'fence-card.tsx'].every(name => !existsSync(`${editorDir}/${name}`)) && !/<(?:Region|Fence)Card\b/.test(editorPanel), 'the lab cards are gone; the yard card focuses instead')
  const selectionBody = readFileSync('src/features/trade-scenes/ui/components/controls/yard-selection-body.tsx', 'utf8')
  assert.ok(selectionBody.includes('data-yard-focus={selected.type}') && selectionBody.includes('removeRegion(') && selectionBody.includes('removeFenceLine(') && selectionBody.includes('regionSelectionAt(') && selectionBody.includes('fenceSelectionAt('), 'the focused card removes its thing and follows it after each write')
  assert.ok(selectionBody.includes('variant="destructive"') && selectionBody.includes('LOT_COPY.wholeYard'), 'Remove is destructive; Whole yard returns to the yard')
  assert.ok(readFileSync('src/features/trade-scenes/ui/components/controls/yard-card-body.tsx', 'utf8').includes('<YardSelectionBody'), 'the yard card focuses on a tapped thing')
  assert.ok(editorPanel.includes('undoLayout(') && editorPanel.includes('selected: null'), 'the panel\'s Undo and Reset let the focused thing go')
  // Drawing starts from a yard card and is steered from the bar; the brush is the bar's pick, read for the view shown.
  assert.deepEqual(groundBrushFor('pavers', 'existing'), { existing: 'pavers', proposed: null })
  assert.deepEqual(groundBrushFor(DRAW_ERASE, 'existing'), { existing: GROUND_BASE, proposed: null })
  assert.deepEqual(groundBrushFor('pavers', 'proposed'), { existing: null, proposed: 'pavers' })
  assert.deepEqual(groundBrushFor(DRAW_ERASE, 'proposed'), { existing: null, proposed: PROPOSED_KEEP })
  assert.deepEqual(fenceBrushFor('vinylFence', 'existing'), { existing: 'vinylFence', proposed: null })
  assert.deepEqual(fenceBrushFor(DRAW_ERASE, 'existing'), { existing: FENCE_NONE, proposed: null })
  assert.deepEqual(fenceBrushFor('vinylFence', 'proposed'), { existing: null, proposed: 'vinylFence' })
  assert.deepEqual(fenceBrushFor(DRAW_ERASE, 'proposed'), { existing: null, proposed: PROPOSED_KEEP })
  // A pick the shown layer does not offer falls back to its first offer, so a flip mid-draw never writes it.
  assert.ok(!GROUND_MATERIALS_BY_LAYER.proposed.includes('sod') && !FENCE_KINDS_BY_LAYER.proposed.includes('chainLink'))
  assert.equal(drawPickFor('sod', GROUND_MATERIALS_BY_LAYER.proposed), GROUND_MATERIALS_BY_LAYER.proposed[0])
  assert.equal(drawPickFor('chainLink', FENCE_KINDS_BY_LAYER.proposed), FENCE_KINDS_BY_LAYER.proposed[0])
  assert.equal(drawPickFor(DRAW_ERASE, GROUND_MATERIALS_BY_LAYER.proposed), DRAW_ERASE)
  assert.equal(drawPickFor('pavers', GROUND_MATERIALS_BY_LAYER.proposed), 'pavers', 'an offered pick stands')
  assert.ok(FENCE_KINDS_BY_LAYER.existing.some(id => FENCE_KINDS[id].gate), 'gates are drawn from the bar')
  assert.deepEqual([drawOffer('ground', 'proposed'), drawOffer('fence', 'existing')], [GROUND_MATERIALS_BY_LAYER.proposed, FENCE_KINDS_BY_LAYER.existing], 'the bar offers each layer\'s own list')
  assert.deepEqual(groundStrokeBrush('sod', 'proposed'), groundBrushFor(GROUND_MATERIALS_BY_LAYER.proposed[0], 'proposed'), 'the stroke and its preview write the fallback, never sod on the build')
  assert.deepEqual(fenceStrokeBrush('chainLink', 'proposed'), fenceBrushFor(FENCE_KINDS_BY_LAYER.proposed[0], 'proposed'))
  assert.deepEqual(groundStrokeBrush(DRAW_ERASE, 'existing'), groundBrushFor(DRAW_ERASE, 'existing'))
  for (const file of ['src/features/trade-scenes/hooks/use-lot-draw-handlers.ts', 'src/features/trade-scenes/ui/components/layout-kit/lot-draw-preview.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.ok(source.includes('groundStrokeBrush(') && source.includes('fenceStrokeBrush(') && !source.includes('_BY_LAYER'), `${file}: one place builds the stroke's brush`)
  }
  const drawStore = createLayoutEditor()
  startDrawing(drawStore, 'fence', 'vinylFence')
  assert.deepEqual([drawStore.getState().mode, drawStore.getState().tool, drawStore.getState().pick.fence], ['draw', 'fence', 'vinylFence'])
  endDrawing(drawStore)
  assert.equal(drawStore.getState().mode, 'orbit')
  assert.equal(endDrawing(drawStore), undefined)
  assert.equal(drawStore.getState().undo.length, 0, 'ending drawing writes no layout')
  drawStore.setState({ selected: { type: 'region', id: '7' }, stroke: { tool: 'ground', from: [1, 1], to: [2, 2] } })
  startDrawing(drawStore, 'ground')
  assert.deepEqual([drawStore.getState().tool, drawStore.getState().pick, drawStore.getState().selected, drawStore.getState().stroke], ['ground', { ground: 'concrete', fence: 'vinylFence' }, null, null], 'a start with no pick keeps the last one and lets the focused thing and any stroke go')
  drawStore.setState({ stroke: { tool: 'ground', from: [1, 1], to: [2, 2] } })
  endDrawing(drawStore)
  assert.equal(drawStore.getState().stroke, null, 'Done drops an open stroke')
  const drawInputs = createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout })
  const drawnOnce = applyStroke(layout, { c0: 1, r0: 1, cols: 2, rows: 2 }, groundBrushFor('pavers', 'existing'))
  assert.notEqual(drawnOnce, layout)
  commitLayout(drawInputs, drawStore, drawnOnce)
  drawStore.setState({ selected: { type: 'region', id: '7' } })
  undoLayout(drawInputs, drawStore)
  assert.deepEqual([drawInputs.getState().layout, drawStore.getState().undo.length, drawStore.getState().selected], [layout, 0, null], 'Undo steps back one layout and lets the focused thing go')
  undoLayout(drawInputs, drawStore)
  assert.equal(drawInputs.getState().layout, layout, 'Undo with nothing to undo changes nothing')
  // Draw mode holds the whole camera; a stroke no longer touches the flag, and a press that never left its tile is no tap.
  const lotSource = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx', 'utf8')
  assert.ok(lotSource.includes('setSceneCameraDrawing(camera, mode === \'draw\')'), 'the lot hands draw mode the camera')
  const strokeSource = readFileSync('src/features/trade-scenes/hooks/use-lot-draw-handlers.ts', 'utf8')
  assert.ok(!strokeSource.includes('setSceneCameraDrawing(') && !strokeSource.includes('selected:') && strokeSource.includes('groundStrokeBrush('), 'the stroke paints the bar\'s pick and neither moves the camera flag nor selects')
  const areasSource = readFileSync('src/features/trade-scenes/ui/components/controls/lot-areas-section.tsx', 'utf8')
  assert.ok(areasSource.includes('endDrawing(editor)') && areasSource.includes('<DrawBar') && areasSource.includes('useSceneTapAway(!drawing'), 'leaving Lot or Areas ends drawing; drawing shows the bar and keeps a tap on the scene from closing Areas')
  const barSource = readFileSync('src/features/trade-scenes/ui/components/controls/draw-bar.tsx', 'utf8')
  assert.ok(barSource.includes('data-draw-bar') && barSource.includes('undoLayout(') && barSource.includes('LAYOUT_EDITOR_COPY.layout.undo') && barSource.includes('LOT_COPY.keep'), 'the bar\'s Undo and Keep are the panel\'s and the card\'s words')
  assert.ok(!editorPanel.includes('LayoutModeToggle') && !editorPanel.includes('BrushPicker'), 'the lab panel keeps Undo, Reset and Copy link')
  assert.ok(['layout-mode-toggle.tsx', 'brush-picker.tsx', 'brush-rows.tsx', 'fence-brush-rows.tsx', 'ground-brush-rows.tsx'].every(name => !existsSync(`${editorDir}/${name}`)) && !existsSync('src/features/trade-scenes/ui/lib/brush-row-values.ts'), 'the brush rows and the mode toggle are gone')
  assert.ok(labView.includes('endDrawing(editor)') && !labView.includes('mode: state.mode'), 'D only ends drawing')
  const lotOrig = lotOrigin(DEFAULT_LAYOUT)
  const worldAt = (col: number, row: number) => [lotOrig.originX + col * DEFAULT_LAYOUT.tile, lotOrig.frontZ - row * DEFAULT_LAYOUT.tile] as const
  const mid = Math.floor(lot.rows / 2)
  // On the lot line, just inside it, just outside it on the neighbour's ground, and on the far face of a wall standing on it.
  for (const col of [0, 0.9, -0.9, 0.4]) {
    assert.deepEqual(magnetVertex(lotOrig, lot, ...worldAt(col, mid + 0.2), MAGNET_TILES), { vertex: [0, mid], lock: { axis: 'along', line: 0 } })
  }
  assert.equal(magnetVertex(lotOrig, lot, ...worldAt(1.2, mid), MAGNET_TILES), null, 'further inside, the nearest grid line draws as before')
  assert.equal(magnetVertex(lotOrig, lot, ...worldAt(-1.2, mid), MAGNET_TILES), null)
  assert.deepEqual(magnetVertex(lotOrig, lot, ...worldAt(lot.cols + 0.5, mid), MAGNET_TILES)!.lock, { axis: 'along', line: lot.cols })
  assert.deepEqual(magnetVertex(lotOrig, lot, ...worldAt(3, lot.rows - 0.3), MAGNET_TILES)!.lock, { axis: 'across', line: lot.rows })
  assert.deepEqual(magnetVertex(lotOrig, lot, ...worldAt(0.3, 0.3), MAGNET_TILES)!.lock, { axis: 'across', line: 0 }, 'a corner tie goes to the front line')
  // The sidewalk overhangs the front line, so a press there lands on the paving, just outside the lot, and the paving
  // takes the fence's draw handlers.
  assert.deepEqual(magnetVertex(lotOrig, lot, ...worldAt(3, -0.4), MAGNET_TILES)!.lock, { axis: 'across', line: 0 })
  assert.ok(/<group \{\.\.\.\(draws && tool === 'fence' \? draws : undefined\)\}>\s*<MergedBoxes boxes=\{boxes\.asphalt\}[^\n]*\n\s*<MergedBoxes boxes=\{boxes\.concrete\}/.test(lotSource), 'a fence press on the paving starts a stroke')
  // The drag runs along the locked line however far the finger strays.
  assert.deepEqual(vertexAlong(lotOrig, lot, { axis: 'along', line: 0 }, ...worldAt(4, mid + 5.4)), [0, mid + 5])
  assert.deepEqual(vertexAlong(lotOrig, lot, { axis: 'along', line: 0 }, ...worldAt(4, lot.rows + 9)), [0, lot.rows])
}

{
  const yards = yardMap(DEFAULT_LAYOUT)
  const mask = massMask(DEFAULT_LAYOUT)
  const back = yardTileIndices(yards, 'back-yard')
  assert.equal(back[3] - back[0], 3, 'the first four back yard tiles run along one row')
  const white = packAppearance(0, 1)
  const tan = packAppearance(0, 3)
  const buff = packAppearance(0, 4)
  const mossBlend = packAppearance(0, 3)
  const herringboneSand = packAppearance(2, 2)
  const gravelIndex = GROUND_MATERIAL_INDEX.gravel
  const zeros = (layout: PropertyLayout) => new Uint8Array(layout.lot.cols * layout.lot.rows)

  const graveled = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: 'gravel', proposed: 'pavers', wear: 'worn', appearanceExisting: white, appearanceProposed: herringboneSand })
  const looked = setYardBase(graveled, 'left-side-yard', { material: 'gravel', appearance: tan })
  const text = encodePropertyLayout(looked)
  assert.equal(JSON.parse(text)._v, 4, 'an_appearance_round_trips: the wire is version 4')
  const back4 = decodePropertyLayout(text, looked.tile)!
  assert.deepEqual(back4.lot.appearance, looked.lot.appearance, 'an_appearance_round_trips: both layers')
  assert.deepEqual(back4.lot.wear, looked.lot.wear, 'an_appearance_round_trips: every tile keeps its wear')
  assert.equal(back4.lot.bases['left-side-yard'].appearance, tan, 'an_appearance_round_trips: a base keeps its appearance')
  assert.deepEqual(back4, looked, 'an_appearance_round_trips: the whole layout')
  assert.equal(looked.lot.appearance.existing[back[0]], white)
  assert.equal(looked.lot.appearance.proposed[back[0]], herringboneSand)

  const asOld = (layout: PropertyLayout, version: 2 | 3) => {
    const w = JSON.parse(encodePropertyLayout(layout))
    w._v = version
    delete w.lot.appearance
    if (version === 2) {
      delete w.lot.wear
      delete w.lot.bases
    }
    else {
      for (const yard of YARD_IDS) {
        delete w.lot.bases[yard].a
      }
    }
    return JSON.stringify(w)
  }
  const fromV3 = decodePropertyLayout(asOld(looked, 3), looked.tile)!
  assert.deepEqual(fromV3.lot.wear, looked.lot.wear, 'old_links_read_default: a v3 link keeps its wear')
  assert.deepEqual(fromV3.lot.appearance, { existing: zeros(looked), proposed: zeros(looked) }, 'old_links_read_default: a v3 link reads no appearance')
  assert.ok(YARD_IDS.every(yard => fromV3.lot.bases[yard].appearance === 0), 'old_links_read_default: a v3 base reads appearance 0')
  assert.equal(fromV3.lot.bases['left-side-yard'].material, 'gravel')
  const fromV2 = decodePropertyLayout(asOld(looked, 2), looked.tile)!
  assert.equal(fromV2.lot.wear[back[0]], GROUND_WEAR_INDEX.good, 'old_links_read_default: a v2 link reads Good')
  assert.deepEqual(fromV2.lot.appearance, { existing: zeros(looked), proposed: zeros(looked) }, 'old_links_read_default: a v2 link reads no appearance')
  assert.ok(YARD_IDS.every(yard => fromV2.lot.bases[yard].appearance === 0), 'old_links_read_default: a v2 base reads appearance 0')

  const pastTheList = packAppearance(0, 15)
  assert.equal(applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'gravel', proposed: null, appearanceExisting: pastTheList }).lot.appearance.existing[back[0]], 0, 'a stroke stores an appearance as its material reads it')
  const gravelPatch = applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'gravel', proposed: null })
  const staleExisting = gravelPatch.lot.appearance.existing.slice()
  staleExisting[back[0]] = pastTheList
  staleExisting[back[1]] = pastTheList
  const stale: PropertyLayout = { ...gravelPatch, lot: { ...gravelPatch.lot, appearance: { ...gravelPatch.lot.appearance, existing: staleExisting } } }
  const opened = decodePropertyLayout(encodePropertyLayout(stale), stale.tile)
  assert.ok(opened, 'an_appearance_past_the_list_still_opens')
  assert.equal(opened.lot.appearance.existing[back[0]], pastTheList, 'an_appearance_past_the_list_still_opens: the byte is kept')
  assert.deepEqual(groundDraw('gravel', 'good', pastTheList), groundDraw('gravel', 'good', 0), 'an_appearance_past_the_list_still_opens: it draws Natural')
  assert.equal(groundDraw('gravel', 'good', pastTheList)?.mapTint, null)
  assert.equal(drawnAppearance('gravel', 'good', pastTheList), 0, 'an_appearance_past_the_list_still_opens: it draws as Natural does')
  assert.equal(drawnAppearance('dirt', null, white), 0, 'a material without appearances draws one look')
  assert.equal(drawnAppearance('asphalt', 'good', packAppearance(0, 2)), packAppearance(0, 2))
  assert.equal(drawnAppearance('asphalt', 'worn', packAppearance(0, 2)), 0, 'worn asphalt keeps its texture\'s own colours')

  const fine = retilePropertyLayout(looked, looked.tile / 2)
  assert.ok(fine.lot.existing.includes(gravelIndex))
  for (let i = 0; i < fine.lot.existing.length; i++) {
    const col = i % fine.lot.cols
    const row = Math.floor(i / fine.lot.cols)
    const source = Math.min(looked.lot.rows - 1, Math.floor(row / 2)) * looked.lot.cols + Math.min(looked.lot.cols - 1, Math.floor(col / 2))
    assert.equal(fine.lot.appearance.existing[i], looked.lot.appearance.existing[source], `retile_keeps_appearance: existing at ${i}`)
    assert.equal(fine.lot.appearance.proposed[i], looked.lot.appearance.proposed[source], `retile_keeps_appearance: proposed at ${i}`)
  }

  const twoGravels = applyStroke(applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'gravel', proposed: null, appearanceExisting: white }), back.slice(10, 12), { existing: 'gravel', proposed: null, appearanceExisting: tan })
  const gravelKeys = groundStripKeys(twoGravels.lot, 'existing', mask).filter(key => key.material === 'gravel')
  assert.deepEqual(gravelKeys.map(key => [key.wear, key.appearance]), [['good', white], ['good', tan]], 'strips_split_on_appearance')
  const dirtLooks = applyStroke(applyStroke(twoGravels, back.slice(20, 22), { existing: 'dirt', proposed: null, appearanceExisting: white }), back.slice(30, 32), { existing: 'dirt', proposed: null })
  assert.deepEqual(groundStripKeys(dirtLooks.lot, 'existing', mask).filter(key => key.material === 'dirt').map(key => key.appearance), [0], 'strips_split_on_appearance: dirt has one look')
  assert.equal(dirtLooks.lot.appearance.existing[back[20]], 0, 'a material with one look stores none')
  const wornAsphalt = applyStroke(applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'asphalt', proposed: null, wear: 'worn', appearanceExisting: packAppearance(0, 1) }), back.slice(10, 12), { existing: 'asphalt', proposed: null, wear: 'worn', appearanceExisting: packAppearance(0, 3) })
  assert.equal(wornAsphalt.lot.appearance.existing[back[0]], packAppearance(0, 1), 'a colour on worn asphalt is kept for when it is made good')
  assert.equal(groundStripKeys(wornAsphalt.lot, 'existing', mask).filter(key => key.material === 'asphalt').length, 1, 'worn asphalt of two colours is one strip')
  const sodLook = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: null, proposed: null, appearanceExisting: white })
  assert.equal(sodLook, DEFAULT_LAYOUT, 'an appearance on sod changes nothing')
  const backRegions = lotRegions(sodLook.lot, mask, yards).filter(r => r.yard === 'back-yard')
  assert.ok(backRegions.length === 1 && backRegions[0].base, 'the back yard stays one base region')

  const today = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: 'gravel', proposed: null, appearanceExisting: white })
  const partBuilt = applyStroke(today, back.slice(0, 2), { existing: null, proposed: 'pavers', appearanceProposed: mossBlend })
  assert.equal(shownGround(partBuilt.lot, 'proposed', back[3]).appearance, white, 'kept_ground_shows_today')
  assert.equal(shownGround(partBuilt.lot, 'proposed', back[0]).appearance, mossBlend, 'kept_ground_shows_today: a built tile shows the build')
  assert.equal(shownGround(partBuilt.lot, 'existing', back[0]).appearance, white)
  const requests = lotTextureRequests(partBuilt.lot)
  assert.ok(requests.some(request => request.set === 'pavers-courtyard' && typeof request.map !== 'string' && request.map.blend === 'gray-moss-charcoal'), 'a blend shown only on the build is held through a toggle')

  const rebuilt = applyStroke(partBuilt, back.slice(0, 4), { existing: null, proposed: null, appearanceProposed: buff })
  assert.equal(rebuilt.lot.appearance.existing, partBuilt.lot.appearance.existing, 'a_build_pick_leaves_today_alone')
  assert.equal(rebuilt.lot.appearance.proposed[back[0]], buff, 'a_build_pick_leaves_today_alone: the build takes it')
  assert.equal(rebuilt.lot.appearance.proposed[back[3]], 0, 'a_build_pick_leaves_today_alone: ground the build keeps takes none')
  assert.equal(applyStroke(partBuilt, back.slice(2, 4), { existing: null, proposed: null, appearanceProposed: buff }), partBuilt, 'a build pick on kept ground changes nothing')
  const viaYard = setYardBuild(partBuilt, 'back-yard', 'landscaping', { appearance: buff })
  assert.equal(viaYard.lot.appearance.existing, partBuilt.lot.appearance.existing, 'a_build_pick_leaves_today_alone: through the yard card')
  assert.deepEqual(yardGroundBuild(setYardBuild(today, 'back-yard', 'landscaping', { material: 'pavers', appearance: mossBlend }).lot, yards, 'back-yard', 'landscaping'), { material: 'pavers', appearance: mossBlend })

  assert.equal(applyStroke(today, back.slice(0, 2), { existing: 'concrete', proposed: null }).lot.appearance.existing[back[0]], 0, 'changing_material_clears_its_color')
  assert.equal(applyStroke(today, back.slice(0, 2), { existing: 'gravel', proposed: null }), today, 'changing_material_clears_its_color: the same material keeps it')
  assert.equal(applyStroke(partBuilt, back.slice(0, 2), { existing: null, proposed: 'turf' }).lot.appearance.proposed[back[0]], 0, 'changing_material_clears_its_color: on the build too')
  assert.equal(applyStroke(partBuilt, back.slice(0, 2), { existing: null, proposed: PROPOSED_KEEP }).lot.appearance.proposed[back[0]], 0, 'Keep clears the build\'s colour')

  const undoInputs = createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout: today })
  const undoEditor = createLayoutEditor()
  commitLayout(undoInputs, undoEditor, applyStroke(today, back.slice(0, 2), { existing: 'mulch', proposed: null, appearanceExisting: packAppearance(0, 2) }))
  assert.equal(undoInputs.getState().layout.lot.existing[back[0]], GROUND_MATERIAL_INDEX.mulch)
  undoLayout(undoInputs, undoEditor)
  const undone = undoInputs.getState().layout.lot
  assert.deepEqual([undone.existing[back[0]], undone.appearance.existing[back[0]]], [gravelIndex, white], 'undo_restores_material_and_appearance')

  assert.equal(lotRegions(today.lot, mask, yards).filter(r => r.existing === 'gravel').length, 1)
  const twoTones = applyStroke(today, back.slice(2, 4), { existing: null, proposed: null, appearanceExisting: tan })
  const twoToneRegions = lotRegions(twoTones.lot, mask, yards).filter(r => r.existing === 'gravel')
  assert.deepEqual(twoToneRegions.map(r => r.appearanceExisting).sort(), [white, tan].sort(), 'regions_split_on_appearance')

  const gravelBack = setYardBase(DEFAULT_LAYOUT, 'back-yard', { material: 'gravel', appearance: white })
  assert.deepEqual(gravelBack.lot.bases['back-yard'], { material: 'gravel', wear: 'good', appearance: white })
  assert.equal(gravelBack.lot.appearance.existing[back[10]], white)
  const patch = applyStroke(gravelBack, back.slice(0, 2), { existing: null, proposed: null, appearanceExisting: tan })
  const rebased = setYardBase(patch, 'back-yard', { appearance: buff })
  assert.equal(rebased.lot.bases['back-yard'].appearance, buff, 'a_base_keeps_its_appearance')
  assert.equal(rebased.lot.appearance.existing[back[10]], buff, 'a_base_keeps_its_appearance: base tiles follow')
  assert.equal(rebased.lot.appearance.existing[back[0]], tan, 'a_base_keeps_its_appearance: a region of another colour is left alone')
  assert.ok(lotRegions(rebased.lot, mask, yards).some(r => r.yard === 'back-yard' && r.base && r.appearanceExisting === buff))
  assert.ok(lotRegions(rebased.lot, mask, yards).some(r => r.yard === 'back-yard' && !r.base && r.appearanceExisting === tan), 'a colour unlike the base is no base')
  const restored = removeRegion(rebased, back.slice(0, 2))
  assert.equal(restored.lot.appearance.existing[back[0]], buff, 'a_base_keeps_its_appearance: removeRegion restores the base\'s appearance')
  assert.equal(setYardBase(rebased, 'back-yard', { appearance: buff }), rebased, 'the same base back changes nothing')
  assert.deepEqual(yardGroundToday(rebased.lot, yards, 'back-yard', 'landscaping'), { material: 'gravel', wear: 'good', appearance: 'mixed' })
  const toned = setYardGround(rebased, 'back-yard', 'landscaping', { appearance: white })
  assert.deepEqual(yardGroundToday(toned.lot, yards, 'back-yard', 'landscaping'), { material: 'gravel', wear: 'good', appearance: white })
  assert.equal(toned.lot.bases['back-yard'].appearance, white, 'a yard pick of the base system colours the base')
  assert.equal(setYardGround(toned, 'back-yard', 'landscaping', { material: 'mulch' }).lot.bases['back-yard'].appearance, 0, 'a new base material starts at its first look')
  assert.equal(setYardBase(DEFAULT_LAYOUT, 'back-yard', { appearance: white }), DEFAULT_LAYOUT, 'a sod base takes no appearance')
  const red = packAppearance(0, 2)
  const gravelAndMulch = applyStroke(setYardBase(DEFAULT_LAYOUT, 'back-yard', { material: 'gravel', appearance: white }), back.slice(10, 14), { existing: 'mulch', proposed: null, appearanceExisting: red })
  assert.equal(yardGroundToday(gravelAndMulch.lot, yards, 'back-yard', 'landscaping')?.material, 'mixed')
  const mixedPick = setYardGround(gravelAndMulch, 'back-yard', 'landscaping', { appearance: tan })
  assert.deepEqual(mixedPick.lot.appearance, gravelAndMulch.lot.appearance, 'an appearance over gravel and mulch changes neither')
  assert.equal(mixedPick.lot.bases['back-yard'].appearance, white)
  const mixedBuild = applyStroke(applyStroke(DEFAULT_LAYOUT, back, { existing: null, proposed: 'gravel' }), back.slice(0, 4), { existing: null, proposed: 'pavers' })
  assert.equal(setYardBuild(mixedBuild, 'back-yard', 'landscaping', { appearance: tan }), mixedBuild, 'an appearance over a mixed build changes nothing')
  assert.equal(setYardGround(gravelAndMulch, 'back-yard', 'landscaping', { material: 'gravel', appearance: tan }).lot.appearance.existing[back[10]], tan, 'a material with its appearance applies over a mix')

  const twoLooks = applyStroke(partBuilt, back.slice(10, 14), { existing: 'gravel', proposed: null, appearanceExisting: tan })
  const link = encodePropertyLayout(twoLooks)
  assert.ok(link.length < 2000, `the_link_stays_short: ${link.length} characters`)
}

console.log('verify-property-layout: ok')
