import type { BufferGeometry } from 'three'
import type { GroundLayer, LotLayout, LotOrigin, PropertyLayout } from '@/features/trade-scenes/types'
import assert from 'node:assert/strict'

import { GROUND_MATERIAL_IDS, GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_WEAR_INDEX } from '@/features/trade-scenes/constants/ground-materials'
import { DEFAULT_LAYOUT } from '@/features/trade-scenes/constants/layout-fixtures'
import { LAYOUT_TILE } from '@/features/trade-scenes/constants/layout-grid'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { applyStroke } from '@/features/trade-scenes/lib/create-layout-editor'
import { emptyFenceMap } from '@/features/trade-scenes/lib/fence-cells'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'
import { pickLayer } from '@/features/trade-scenes/lib/pick-layer'
import { groundStripKeys, shownGround } from '@/features/trade-scenes/lib/shown-ground'
import { yardMap, yardTileIndices } from '@/features/trade-scenes/lib/yards'
import { fenceBandGeometry } from '@/features/trade-scenes/ui/lib/fence-band-geometry'
import { regionStripGeometry } from '@/features/trade-scenes/ui/lib/region-strip-geometry'

const COLS = 4
const ROWS = 3
const origin: LotOrigin = { originX: -1, frontZ: 2, tile: LAYOUT_TILE }
const raise = 0.04
const flat = () => 0
// The attributes are float32, so an expected metre is rounded the same way before it is compared.
const f32 = Math.fround

function quadsOf(geometry: BufferGeometry): number {
  return (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 6
}

function lotOf(existing: number[], proposed: number[] = existing.map(() => 0)): LotLayout {
  return {
    cols: COLS,
    rows: ROWS,
    existing: Uint8Array.from(existing),
    proposed: Uint8Array.from(proposed),
    fence: { existing: emptyFenceMap({ cols: COLS, rows: ROWS }), proposed: emptyFenceMap({ cols: COLS, rows: ROWS }) },
    wear: new Uint8Array(COLS * ROWS),
    appearance: { existing: new Uint8Array(COLS * ROWS), proposed: new Uint8Array(COLS * ROWS) },
    bases: Object.fromEntries(YARD_IDS.map(yard => [yard, { material: 'sod', wear: 'good', appearance: 0 }])) as LotLayout['bases'],
    grade: { padEndRow: 0, walkDrop: 0, streetDrop: 0 },
  }
}

const lot = lotOf(Array.from({ length: COLS * ROWS }, () => 1))
const noMask = new Uint8Array(COLS * ROWS)
const tileIndex = (c: number, r: number) => r * COLS + c
const block = new Set([tileIndex(1, 0), tileIndex(2, 0), tileIndex(1, 1), tileIndex(2, 1)])

// A 2 × 2 block is one run on each of its two rows: two quads.
const blockStrip = regionStripGeometry(lot, origin, flat, noMask, i => block.has(i), raise)
const blockPositions = blockStrip.getAttribute('position')
assert.equal(quadsOf(blockStrip), 2, 'a 2 × 2 block is two quads')
assert.equal(blockPositions.count, blockStrip.getIndex() ? 8 : 12, 'two quads are 12 vertices, or 8 with an index')

for (let v = 0; v < blockPositions.count; v++) {
  assert.equal(blockPositions.getY(v), f32(raise), `vertex ${v} sits at the raise on flat ground`)
}

// Non-indexed so a strip's vertices carry their own uvs and the tiling texture repeats per metre.
assert.equal(blockStrip.getIndex(), null, 'the strip is non-indexed')
assert.equal(blockPositions.count, 12, 'two quads are 12 vertices')

const blockNormals = blockStrip.getAttribute('normal')
const blockUvAttr = blockStrip.getAttribute('uv')
for (let v = 0; v < blockPositions.count; v++) {
  assert.deepEqual([blockNormals.getX(v), blockNormals.getY(v), blockNormals.getZ(v)], [0, 1, 0], `vertex ${v} normal points up`)
  assert.equal(blockUvAttr.getY(v), blockPositions.getZ(v), `vertex ${v} uv.y is its world z`)
}

// The y of (b - a) x (c - a) is (bz - az)(cx - ax) - (bx - ax)(cz - az); above zero means the face looks up.
for (let t = 0; t < blockPositions.count; t += 3) {
  const [a, b, c] = [t, t + 1, t + 2].map(v => ({ x: blockPositions.getX(v), z: blockPositions.getZ(v) }))
  const facingY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
  assert.ok(facingY > 0, `triangle ${t / 3} faces up (${facingY})`)
}

const blockUvs = blockStrip.getAttribute('uv')
const uvXs = Array.from({ length: blockUvs.count }, (_, v) => blockUvs.getX(v))
assert.equal(Math.min(...uvXs), f32(origin.originX + 1 * origin.tile), 'uv x starts at the block\'s left edge')
assert.equal(Math.max(...uvXs), f32(origin.originX + 3 * origin.tile), 'uv x ends at the block\'s right edge')

// Each corner takes the height at its own z, so the strip follows the grade from the street back.
const nearZ = f32(origin.frontZ)
const farZ = f32(origin.frontZ - 2 * origin.tile)
function cornerHeights(heightAt: (z: number) => number) {
  const positions = regionStripGeometry(lot, origin, heightAt, noMask, i => block.has(i), raise).getAttribute('position')
  const front: number[] = []
  const back: number[] = []
  for (let v = 0; v < positions.count; v++) {
    const z = positions.getZ(v)
    assert.ok(Math.abs(positions.getY(v) - (heightAt(z) + raise)) < 1e-5, `vertex ${v} sits on the grade at its own z`)
    if (z === nearZ) {
      front.push(positions.getY(v))
    }
    if (z === farZ) {
      back.push(positions.getY(v))
    }
  }
  assert.ok(front.length > 0 && back.length > 0, 'the block has front and back corners')
  return { front, back }
}
const rising = cornerHeights(z => z)
assert.ok(Math.min(...rising.front) > Math.max(...rising.back), 'with heightAt = z, the front corners sit higher than the back ones')
const fallingToStreet = cornerHeights(z => -z)
assert.ok(Math.max(...fallingToStreet.front) < Math.min(...fallingToStreet.back), 'on a grade that falls to the street, the front corners sit lower than the back ones')

// A masked tile in the middle of a picked row splits the row's run in two.
const mask = new Uint8Array(COLS * ROWS)
mask[tileIndex(1, 2)] = 1
const splitStrip = regionStripGeometry(lot, origin, flat, mask, i => Math.floor(i / COLS) === 2, raise)
assert.equal(quadsOf(splitStrip), 2, 'a masked tile breaks the run into two quads')

assert.equal(pickLayer(lotOf([2], [0]), 'existing', 0), 2, 'the existing layer reads the existing value')
assert.equal(pickLayer(lotOf([2], [0]), 'proposed', 0), 2, 'a kept proposed tile falls back to the existing value')
assert.equal(pickLayer(lotOf([2], [5]), 'proposed', 0), 5, 'a proposed value wins in the proposed layer')

const band = fenceBandGeometry({ axis: 'along', line: 1, from: 0, to: 3 }, origin, z => -z, 0.12, 0.05)
assert.equal(quadsOf(band), 3, 'one quad per cell')
const bandPositions = band.getAttribute('position')
for (let v = 0; v < bandPositions.count; v++) {
  assert.ok(Math.abs(bandPositions.getY(v) - (-bandPositions.getZ(v) + 0.05)) < 1e-5, `band vertex ${v} sits on the grade at its own z`)
  assert.ok(Math.abs(Math.abs(bandPositions.getX(v) - (origin.originX + origin.tile)) - 0.06) < 1e-5, `band vertex ${v} is half a width off the line`)
}
const acrossBand = fenceBandGeometry({ axis: 'across', line: 2, from: 1, to: 3 }, origin, flat, 0.12, 0)
assert.equal(quadsOf(acrossBand), 2)

{
  const keysOf = (layout: PropertyLayout, layer: GroundLayer) => groundStripKeys(layout.lot, layer, massMask(layout)).map(k => `${k.material}:${k.wear}`).sort()
  assert.deepEqual(keysOf(DEFAULT_LAYOUT, 'existing'), ['concrete:good', 'mulch:good'], 'the default lot mounts the strips it mounts today')
  const lawn = yardTileIndices(yardMap(DEFAULT_LAYOUT), 'back-yard')
  const wornSod = applyStroke(DEFAULT_LAYOUT, lawn.slice(0, 3), { existing: null, proposed: null, wear: 'worn' })
  assert.ok(keysOf(wornSod, 'existing').includes('sod:worn'))
  const fresh = applyStroke(DEFAULT_LAYOUT, lawn.slice(0, 3), { existing: null, proposed: null, wear: 'new' })
  assert.deepEqual(keysOf(fresh, 'existing'), keysOf(DEFAULT_LAYOUT, 'existing'), 'New draws as Good')
  // The build keeps a worn lawn worn and draws what it installs as New.
  const turfed = applyStroke(wornSod, lawn.slice(0, 1), { existing: null, proposed: 'turf' })
  assert.deepEqual(shownGround(turfed.lot, 'proposed', lawn[0]), { material: GROUND_MATERIAL_INDEX.turf, wear: GROUND_WEAR_INDEX.new, appearance: 0 })
  assert.deepEqual(shownGround(turfed.lot, 'proposed', lawn[1]), { material: GROUND_MATERIAL_INDEX.sod, wear: GROUND_WEAR_INDEX.worn, appearance: 0 })
  for (const id of GROUND_MATERIAL_IDS) {
    assert.equal(GROUND_MATERIALS[id].wearLook === null, !GROUND_MATERIALS[id].wears)
  }
}

console.log('verify-layout-kit: ok')
