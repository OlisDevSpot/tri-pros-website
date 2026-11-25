import type { CoveringPiece, CoveringWear } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'
import type { RoofType, Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialFacts, ResolvedPart } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { InstancedBufferAttribute, ShaderLib } from 'three'
import { COVERING_WEAR_KINDS_BY_ROOF, COVERING_WEAR_START } from '@/features/trade-scenes/constants/covering-wear'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { coveringLook, coveringShares } from '@/features/trade-scenes/lib/covering-look'
import { writePieceMarks } from '@/features/trade-scenes/lib/covering-piece-marks'
import { coveringWearInForce } from '@/features/trade-scenes/lib/covering-wear-in-force'
import { homeMaterialPatch } from '@/features/trade-scenes/lib/home-material-patch'
import { SHAKE, SHINGLE, TILE } from '@/features/trade-scenes/lib/home-roof-layout'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { piecesInSpan } from '@/features/trade-scenes/lib/pieces-in-span'
import { layoutShakes } from '@/features/trade-scenes/lib/shake-layout'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { coveringCourseGeometry } from '@/features/trade-scenes/ui/lib/covering-course-geometry'
import { injectCoveringWear } from '@/features/trade-scenes/ui/lib/inject-covering-wear'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'

const YEAR = 2026
const near = (actual: number, expected: number, tolerance: number, message: string) => assert.ok(Math.abs(actual - expected) < tolerance, `${message} (${actual} vs ${expected})`)
const tileProperty = { ...HOME_SCENE_DEFAULTS.property, roofType: 'tile' as const }
const roofAt = (wear: Wear) => resolveHomeMaterials({ property: tileProperty, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: wear } }, year: YEAR }).roof

assert.deepEqual(COVERING_WEAR_START.new, { cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' })
assert.deepEqual(COVERING_WEAR_START.good, { cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' })
assert.deepEqual(COVERING_WEAR_START.fair, { cracked: 'light', misaligned: 'light', broken: 'none', missing: 'none', curling: 'light', split: 'light' })
assert.deepEqual(COVERING_WEAR_START.worn, { cracked: 'moderate', misaligned: 'moderate', broken: 'light', missing: 'moderate', curling: 'moderate', split: 'moderate' })
assert.deepEqual(COVERING_WEAR_START.failing, { cracked: 'heavy', misaligned: 'heavy', broken: 'moderate', missing: 'heavy', curling: 'heavy', split: 'heavy' })

assert.deepEqual(COVERING_WEAR_KINDS_BY_ROOF, {
  tile: ['cracked', 'misaligned', 'broken'],
  shingle: ['missing', 'curling'],
  woodshake: ['split', 'curling'],
  flat: [],
  metal: [],
})
assert.ok(!Object.values(COVERING_WEAR_KINDS_BY_ROOF).flat().some(kind => (kind as string) === 'dirt'), 'no roof lists a dirt kind')

assert.deepEqual(coveringWearInForce(roofAt('fair'), {}, 'tile'), COVERING_WEAR_START.fair, 'the wear sets the start')
assert.equal(coveringWearInForce(roofAt('worn'), { cracked: 'heavy' }, 'tile').cracked, 'heavy', 'a level the rep set wins')
assert.equal(coveringWearInForce(roofAt('worn'), { cracked: 'heavy' }, 'tile').broken, 'light', 'and leaves the others at the start')
assert.deepEqual(coveringWearInForce(roofAt('new'), { cracked: 'heavy' }, 'tile'), COVERING_WEAR_START.new, 'a new covering shows none')
assert.deepEqual(coveringWearInForce(undefined, { cracked: 'heavy' }, 'tile'), COVERING_WEAR_START.new, 'no roof, no wear')

const patchState = (coveringWear: HomeMaterialFacts['coveringWear']) => ({ property: tileProperty, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, coveringWear, paintWear: { stains: 'heavy' as const }, wear: { 'roof': 'worn' as const, 'exterior-paint': 'worn' as const } }, proposedScopeIds: [], efficiencyUpgrades: [] })
assert.deepEqual(homeMaterialPatch(patchState({ cracked: 'heavy' }), { kind: 'wear', id: 'roof', wear: 'good' }, YEAR).homeMaterials?.coveringWear, { cracked: 'heavy' }, 'a wear change keeps the rep\'s levels')
const roofBack = homeMaterialPatch(patchState({ cracked: 'heavy' }), { kind: 'era-guess', id: 'roof' }, YEAR)
assert.deepEqual(roofBack.homeMaterials?.coveringWear, {}, 'back to the era guess clears them')
assert.equal(roofBack.homeMaterials?.wear.roof, undefined, 'with the wear')
assert.deepEqual(roofBack.homeMaterials?.paintWear, { stains: 'heavy' }, 'and leaves the paint\'s alone')
assert.deepEqual(homeMaterialPatch(patchState({ cracked: 'heavy' }), { kind: 'era-guess', id: 'exterior-paint' }, YEAR).homeMaterials?.coveringWear, { cracked: 'heavy' }, 'the paint\'s era guess leaves the roof\'s alone')

const recordedOnTile = { cracked: 'heavy', missing: 'heavy' } as const
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'tile').cracked, 'heavy')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'tile').missing, 'moderate', 'a shingle kind recorded under tile does not count on tile')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'shingle').missing, 'heavy', 'and comes back when the roof is shingle')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'shingle').cracked, 'moderate', 'where the tile kind stops counting')
assert.deepEqual(coveringWearInForce(roofAt('worn'), recordedOnTile, 'metal'), COVERING_WEAR_START.worn, 'metal draws shingle\'s starting amounts, never a recorded level')

const factsFor = (roofType: RoofType) => ({ property: { ...HOME_SCENE_DEFAULTS.property, roofType }, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' as const } }, year: YEAR })
function roofParts(roofType: RoofType, scopes: string[], view: 'existing' | 'proposed' = 'proposed') {
  const facts = factsFor(roofType)
  return resolveAssembly(ASSEMBLIES['roof-attic'], { existing: inferRoofAtticExistingConditions(facts, resolveHomeMaterials(facts)), proposedScopeIds: scopes, view })
}
const coveringOf = (parts: readonly ResolvedPart[]) => parts.find(part => part.id === 'covering')!

const reset = roofParts('tile', [SCOPE_IDS.roofTileReset])
assert.equal(coveringOf(reset).condition, 'installed', 'the part list and savings still read an install')
assert.equal(coveringOf(reset).reused, true)
assert.equal(coveringOf(reset).wear, 'worn', 'it keeps the old tile\'s wear')
assert.equal(partState(reset, 'covering').wear, WEAR_AMOUNT.worn, 'so it draws in the weathered colour')
assert.equal(reset.find(part => part.id === 'underlayment')!.reused, undefined, 'the waterproofing under it is new')
assert.equal(partState(reset, 'underlayment').wear, 0)

assert.equal(coveringOf(roofParts('tile', [SCOPE_IDS.roofTileReset], 'existing')).reused, undefined, 'the existing view reuses nothing')

const onShingle = roofParts('shingle', [SCOPE_IDS.roofTileReset])
assert.equal(coveringOf(onShingle).material, 'tile')
assert.equal(coveringOf(onShingle).reused, undefined, 'there were no tiles to reuse')
assert.equal(partState(onShingle, 'covering').wear, 0, 'so it draws new')

const tearOff = roofParts('tile', [SCOPE_IDS.roofTearOff])
assert.equal(coveringOf(tearOff).reused, undefined, 'a tear-off lays a new covering')
assert.equal(partState(tearOff, 'covering').wear, 0)

const redeck = roofParts('tile', [SCOPE_IDS.roofRedeck])
assert.equal(partState(redeck, 'covering').wear, WEAR_AMOUNT.worn, 'a redeck alone leaves the covering as it was')

const levels = (patch: Partial<CoveringWear>): CoveringWear => ({ ...COVERING_WEAR_START.new, ...patch })
const part = (condition: ResolvedPart['condition'], extra: Partial<ResolvedPart> = {}): ResolvedPart[] => [{ id: 'covering', group: 'roof', role: 'surface', material: 'tile', condition, wear: 'worn', label: '', detail: '', thermal: null, water: null, ...extra }]
const heavy = levels({ cracked: 'heavy' })

assert.deepEqual(coveringLook(part('retained'), heavy).levels, heavy, 'an old covering shows its wear')
assert.deepEqual(coveringLook(part('installed'), heavy).levels, COVERING_WEAR_START.new, 'a new one shows none')
assert.deepEqual(coveringLook([], heavy).levels, COVERING_WEAR_START.new, 'no covering, none')
assert.deepEqual(coveringLook(part('installed', { reused: true }), heavy).levels, heavy, 'a reused covering still knows what the existing roof showed')
assert.equal(coveringLook(part('installed', { reused: true }), heavy).reused, true)

const courseArea = (patch: Partial<CoveringWear>) => ({ seed: 7, wear: WEAR_AMOUNT.worn, xFrom: 0, xTo: 12, zFrom: -5, zTo: 5, base: 0.1, shares: coveringShares(levels(patch)), reused: false })
const allTabs = layoutShingles(courseArea({}), SHINGLE).length
const moderateMissing = 1 - layoutShingles(courseArea({ missing: 'moderate' }), SHINGLE).length / allTabs
assert.ok(moderateMissing > 0.02 && moderateMissing < 0.08, `moderate Missing is about 5% of tabs, got ${moderateMissing}`)
assert.equal(layoutShingles(courseArea({ curling: 'heavy' }), SHINGLE).length, allTabs, 'Curling removes no tab')
assert.ok(layoutShingles(courseArea({ curling: 'moderate' }), SHINGLE).some(piece => piece.tilt < -0.2), 'Curling lifts tabs')
assert.ok(layoutShingles(courseArea({ missing: 'heavy' }), SHINGLE).length < layoutShingles(courseArea({ missing: 'light' }), SHINGLE).length, 'more goes missing as the level climbs')

// A tab is keyed by where it sits, so a level that removes tabs cannot be mistaken for one that moves them.
const tabKey = (piece: PieceLayout) => `${piece.x.toFixed(4)}:${piece.z.toFixed(4)}`
const curledNoGaps = new Map(layoutShingles(courseArea({ curling: 'moderate' }), SHINGLE).map(piece => [tabKey(piece), piece]))
const curledGaps = layoutShingles(courseArea({ curling: 'moderate', missing: 'heavy' }), SHINGLE)
assert.ok(curledGaps.every(piece => curledNoGaps.get(tabKey(piece))?.tilt === piece.tilt && curledNoGaps.get(tabKey(piece))?.shade === piece.shade), 'Missing leaves every other tab as it was')
const gapsFlat = layoutShingles(courseArea({ missing: 'moderate' }), SHINGLE)
assert.deepEqual(layoutShingles(courseArea({ missing: 'moderate', curling: 'heavy' }), SHINGLE).map(tabKey), gapsFlat.map(tabKey), 'Curling leaves the gaps where they were')

const flatShakes = layoutShakes(courseArea({}), SHAKE)
assert.ok(flatShakes.every(piece => piece.tilt > -0.2), 'no Curling, no curled shake')
assert.ok(layoutShakes(courseArea({ curling: 'moderate' }), SHAKE).some(piece => piece.tilt < -0.2), 'Curling curls them')
assert.deepEqual(layoutShakes(courseArea({ curling: 'heavy' }), SHAKE).map(piece => [piece.x, piece.z, piece.width, piece.shade]), flatShakes.map(piece => [piece.x, piece.z, piece.width, piece.shade]), 'Curling moves, splits and re-shades no shake')
assert.ok(layoutShakes(courseArea({ split: 'moderate' }), SHAKE).length > flatShakes.length, 'Split draws a shake as two halves')
assert.ok(layoutShakes(courseArea({ split: 'heavy' }), SHAKE).length > layoutShakes(courseArea({ split: 'light' }), SHAKE).length, 'more split as the level climbs')

function tilesAt(patch: Partial<CoveringWear>, reused = false) {
  const { pans, caps } = layoutTiles({ ...courseArea(patch), reused }, TILE)
  return [...pans, ...caps]
}
const clean = tilesAt({})
const gridOf = new Map(clean.map((tile, index) => [index, tile]))
const offGrid = (tile: CoveringPiece, index: number) => Math.abs(tile.x - gridOf.get(index)!.x) + Math.abs(tile.z - gridOf.get(index)!.z)
const meanOffGrid = (tiles: readonly CoveringPiece[]) => tiles.reduce((sum, tile, index) => sum + offGrid(tile, index), 0) / tiles.length

assert.ok(clean.every(tile => tile.tilt === -0.05 && !tile.yaw && !tile.crack && !tile.broken && !tile.replacement), 'no wear, every tile straight and whole')
assert.equal(tilesAt({ broken: 'heavy', cracked: 'heavy', misaligned: 'heavy' }).length, clean.length, 'no tile is ever missing')

const crooked = tilesAt({ misaligned: 'moderate' })
assert.ok(crooked.filter((tile, index) => offGrid(tile, index) > 0).length > clean.length * 0.8, 'misalignment runs across the whole roof')
assert.ok(meanOffGrid(tilesAt({ misaligned: 'heavy' })) > meanOffGrid(crooked), 'and scales with the amount')
assert.ok(meanOffGrid(crooked) > meanOffGrid(tilesAt({ misaligned: 'light' })))
assert.ok(crooked.some(tile => tile.tilt <= -0.16), 'some have slipped out of place')
assert.ok(tilesAt({ misaligned: 'heavy' }).every((tile, index) => Math.abs(tile.x - gridOf.get(index)!.x) < TILE.length - TILE.exposure), 'a slipped tile still laps the one below')

const cracked = tilesAt({ cracked: 'moderate' })
assert.ok(cracked.filter(tile => tile.crack).length > clean.length * 0.05, 'cracked tiles are there at Moderate')
assert.ok(tilesAt({ cracked: 'heavy' }).filter(tile => tile.crack).length > cracked.filter(tile => tile.crack).length)
assert.ok(tilesAt({ broken: 'heavy' }).filter(tile => tile.broken).length < clean.length * 0.1, 'broken tiles stay occasional')
assert.ok(tilesAt({ broken: 'light' }).some(tile => tile.broken))
assert.ok(cracked.every(tile => !tile.broken), 'one level never places another kind')

// A cracked or broken tile keeps its misalignment, so raising Cracked or Broken moves no tile.
const whole = tilesAt({ misaligned: 'moderate' })
const marked = tilesAt({ misaligned: 'moderate', cracked: 'heavy', broken: 'heavy' })
assert.ok(marked.every((tile, index) => (tile.x === whole[index].x && tile.z === whole[index].z && tile.tilt === whole[index].tilt && tile.yaw === whole[index].yaw && tile.shade === whole[index].shade)), 'Cracked and Broken move no tile')
assert.deepEqual(tilesAt({ misaligned: 'moderate', cracked: 'heavy' }).map(tile => tile.shade), whole.map(tile => tile.shade), 'and re-shade none')

const existing = tilesAt({ cracked: 'moderate', broken: 'moderate', misaligned: 'heavy' })
const afterReset = tilesAt({ cracked: 'moderate', broken: 'moderate', misaligned: 'heavy' }, true)
assert.equal(afterReset.length, existing.length, 'the same tiles')
assert.deepEqual(afterReset.map(tile => tile.shade), existing.map(tile => tile.shade), 'each keeps its own shade')
assert.ok(afterReset.every((tile, index) => tile.x === gridOf.get(index)!.x && tile.z === gridOf.get(index)!.z && tile.tilt === -0.05 && !tile.yaw), 'straight and lined up')
assert.ok(afterReset.every(tile => !tile.crack && !tile.broken), 'nothing cracked or broken is left')
assert.deepEqual(afterReset.map(tile => tile.replacement === true), existing.map(tile => Boolean(tile.crack || tile.broken)), 'exactly the cracked and broken tiles are replaced')

const noneToReplace = tilesAt({ cracked: 'none', broken: 'none', misaligned: 'heavy' }, true)
assert.ok(noneToReplace.every(tile => !tile.replacement), 'with nothing cracked or broken, no tile is replaced')
assert.ok(noneToReplace.every((tile, index) => tile.tilt === -0.05 && tile.x === gridOf.get(index)!.x), 'and the roof is still straightened')

// The marks ride in the covering's own draw: a span written in its own order keeps each tile's crack with that tile, and
// three's own ShaderLib is patched, so a three upgrade that moves a chunk fails here rather than on the iPad.
{
  const whole = [...layoutTiles({ ...courseArea({ cracked: 'heavy', broken: 'heavy' }) }, TILE).pans]
  const span = piecesInSpan(whole, 0, 5, false)
  assert.ok(span.length < whole.length && span.some(piece => piece.crack || piece.broken))
  const marks = new Float32Array(whole.length * 2).fill(-1)
  writePieceMarks(marks, span)
  span.forEach((piece, index) => {
    near(marks[index * 2], piece.crack ?? 0, 1e-6, 'a crack stays with its tile')
    near(marks[index * 2 + 1], piece.broken ?? 0, 1e-6, 'and a broken corner')
  })

  const geometry = coveringCourseGeometry('pan', 12)
  const pieceMark = geometry.getAttribute('pieceMark')
  assert.ok(pieceMark instanceof InstancedBufferAttribute && pieceMark.count === 12 && pieceMark.itemSize === 2)
  assert.ok(coveringCourseGeometry('cap', 3).getAttribute('pieceMark') instanceof InstancedBufferAttribute, 'a cap carries its tile\'s marks too')
  assert.ok(['shingle', 'shake'].every(course => coveringCourseGeometry(course as 'shingle' | 'shake', 3).getAttribute('pieceMark') === undefined), 'a shingle or shake has no marks to carry')

  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader }
  injectCoveringWear(shader)
  assert.ok(shader.vertexShader.includes('attribute vec2 pieceMark'), 'the vertex chunk was found')
  assert.ok(shader.fragmentShader.includes('vCoveringMark') && shader.fragmentShader.includes('fwidth'), 'the fragment chunk was found')
  assert.ok(shader.fragmentShader.includes('discard'), 'a broken corner is really gone')
  for (const anchor of ['#include <begin_vertex>', '#include <color_fragment>']) {
    const text = anchor.includes('vertex') ? shader.vertexShader : shader.fragmentShader
    assert.equal(text.split(anchor).length - 1, 1, `${anchor} is still there once, with the wear after it`)
  }
  const varyings = [...shader.vertexShader.matchAll(/varying\s+\w+\s+(\w+)/g)].map(match => match[1]).filter(name => name.startsWith('vCovering'))
  assert.ok(varyings.length > 0 && varyings.every(name => new RegExp(`varying\\s+\\w+\\s+${name}\\b`).test(shader.fragmentShader)), 'every varying the wear passes is declared on both sides')
}

console.log('✓ covering wear')
