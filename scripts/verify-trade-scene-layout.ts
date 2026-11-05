import type { ControlsSection, StageShape, SystemsFocus, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { HomeFacts, PropertyProfile } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'

import { INFER_EXISTING_CONDITIONS } from '@/features/trade-scenes/constants/existing-conditions'
import { PART_LABELS, SCENE_COPY, SHORTCUT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { HOME_SYSTEMS } from '@/features/trade-scenes/constants/home-systems'
import { PAINT_WEAR_START } from '@/features/trade-scenes/constants/paint-wear'
import { PROFILE_ROOF_TYPES } from '@/features/trade-scenes/constants/scene-controls'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUTS, SHORTCUT_SHEET_ROWS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { SCOPE_VERBS } from '@/features/trade-scenes/constants/scope-verbs'
import { applySceneChange } from '@/features/trade-scenes/lib/apply-scene-change'
import { flipView, pressFocus, pressSection } from '@/features/trade-scenes/lib/controls-press'
import { dockHeightFor, dockLayoutFor, dockRegionFor } from '@/features/trade-scenes/lib/dock-layout-for'
import { efficiencyUpgradePatch } from '@/features/trade-scenes/lib/efficiency-upgrade-patch'
import { homeHeat } from '@/features/trade-scenes/lib/home-heat'
import { homeMaterialPatch } from '@/features/trade-scenes/lib/home-material-patch'
import { paintWearInForce } from '@/features/trade-scenes/lib/paint-wear-in-force'
import { alsoNewLabels, baseIncludedLabel, existingParts, keepOffered, offeredScopes, partOffers } from '@/features/trade-scenes/lib/part-offers'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { repairsFigure } from '@/features/trade-scenes/lib/repairs-figure'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { sceneSavings } from '@/features/trade-scenes/lib/scene-savings'
import { sceneVisibleAreaFor } from '@/features/trade-scenes/lib/scene-visible-area-for'
import { scopePick } from '@/features/trade-scenes/lib/scope-pick'
import { scopePreviewPatch } from '@/features/trade-scenes/lib/scope-preview-patch'
import { stageShapeOf } from '@/features/trade-scenes/lib/stage-shape-of'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { ROOF_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/roof-attic'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'
import { CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'
import { paintWearKinds, paintWearLevels, roofTypes, wears } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_FACTS_UNSET, HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { REPAIRS_PER_YEAR } from '@/shared/modules/construction/core/constants/repairs-per-year'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { SCOPES_BY_EXISTING_ROOF } from '@/shared/modules/construction/core/constants/scopes-by-existing-roof'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'

const ID = 'roof-attic'
const YEAR = 2026
const profile = (patch: Partial<PropertyProfile>): PropertyProfile => ({ ...HOME_SCENE_DEFAULTS.property, roofType: null, ...patch })
function offerOf(partId: string) {
  const offer = partOffers(ID).find(candidate => candidate.partId === partId)
  assert.ok(offer, `${partId} has an offer`)
  return offer
}
const unset = (property: PropertyProfile): HomeFacts => ({ property, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR })
function offered(partId: string, roofType: PropertyProfile['roofType'], picks: readonly string[] = []) {
  return offeredScopes(offerOf(partId), { roofType, picks, existing: existingParts(ID, unset(profile({ roofType }))), assemblyId: ID, wear: null, efficiencyUpgrades: [] })
}
const keep = (picks: string[], roofType: PropertyProfile['roofType']) => keepOffered(picks, unset(profile({ roofType })), [])

const { roofTorchDown, roofOverlay, roofTearOff, roofRedeck, gutters, radiantBarrier, airSealing, atticInsulationReplacement, atticInsulationTopOff } = SCOPE_IDS

// Part order.
const offers = partOffers(ID)
assert.deepEqual(offers.map(offer => offer.partId), ['covering', 'deck', 'radiant-barrier', 'attic-fan', 'attic-insulation', 'air-sealing', 'gutter'])
assert.deepEqual(offers.filter(offer => offer.dependsOnRoof).map(offer => offer.partId), ['covering', 'deck'])
for (const offer of offers) {
  assert.ok(PART_LABELS[offer.partId], `${offer.partId}: has a label`)
}

// Each roof type with no picks.
for (const roofType of PROFILE_ROOF_TYPES) {
  const coverings = SCOPES_BY_EXISTING_ROOF[roofType].filter(id => id !== roofRedeck)
  const covering = offered('covering', roofType)
  const deck = offered('deck', roofType)
  assert.deepEqual(covering.scopeIds, coverings, `${roofType}: the covering offers its R81 scopes`)
  assert.equal(covering.blocked, coverings.length === 0 ? 'nothing-on-roof' : null, `${roofType}: covering`)
  assert.deepEqual(deck.scopeIds, [], `${roofType}: the deck offers nothing with no picks`)
  assert.equal(deck.blocked, roofType === 'metal' ? 'nothing-on-roof' : 'needs-tear-off', `${roofType}: deck`)
}

// No roof type.
assert.equal(offered('covering', null).blocked, 'roof-not-set')
assert.equal(offered('deck', null).blocked, 'roof-not-set')
for (const roofType of [null, 'metal'] as const) {
  const insulation = offered('attic-insulation', roofType)
  assert.deepEqual(insulation.scopeIds, [atticInsulationReplacement, atticInsulationTopOff], `${roofType}: insulation still offered`)
  assert.equal(insulation.blocked, null)
}

// The deck follows the covering.
assert.deepEqual(offered('deck', 'shingle', [roofTearOff]), { scopeIds: [roofRedeck], blocked: null })
assert.equal(offered('deck', 'shingle', [roofOverlay]).blocked, 'needs-tear-off')

// The deck's base.
assert.equal(offered('deck', 'woodshake', [roofTearOff]).blocked, 'base-included')
const needsBase = ROOF_ATTIC.parts.find(part => part.id === 'covering')?.materials.shingle.needsBase
assert.ok(needsBase)
assert.equal(baseIncludedLabel(ID, [roofTearOff], existingParts(ID, unset(profile({ roofType: 'woodshake' })))), needsBase.copy.label)
assert.equal(baseIncludedLabel(ID, [roofTearOff], existingParts(ID, unset(profile({ roofType: 'shingle' })))), null, 'a plywood deck stays, so no base is included')

// keepOffered.
assert.deepEqual(keep([roofTearOff, roofRedeck, gutters], 'shingle'), [roofTearOff, roofRedeck, gutters])
assert.deepEqual(keep([roofOverlay, roofRedeck], 'shingle'), [roofOverlay])
assert.deepEqual(keep([roofTearOff, roofRedeck], 'tile'), [])
assert.deepEqual(keep([roofTearOff, roofRedeck, radiantBarrier], 'metal'), [radiantBarrier])
assert.deepEqual(keep([roofTearOff, roofRedeck, radiantBarrier], null), [radiantBarrier])

// Under a flat roof there is no attic to work from: no radiant barrier, no air sealing; insulation is still offered.
const rowsOn = (roofType: PropertyProfile['roofType']) => upgradeRows(unset(profile({ roofType })), [], []).flatMap(system => system.rows.map(row => row.offer.partId))
for (const partId of ['radiant-barrier', 'attic-fan', 'air-sealing']) {
  assert.ok(!rowsOn('flat').includes(partId), `flat: no ${partId} row`)
  for (const roofType of [null, 'shingle', 'tile', 'woodshake', 'metal'] as const) {
    assert.ok(rowsOn(roofType).includes(partId), `${roofType}: ${partId} has a row`)
    assert.equal(offered(partId, roofType).blocked, null, `${roofType}: ${partId} is offered`)
  }
}

for (const row of HOME_SYSTEMS.flatMap(system => system.rows)) {
  assert.ok(PART_LABELS[row.part], `${row.part}: has a label`)
}
assert.deepEqual(offered('attic-insulation', 'flat'), { scopeIds: [], blocked: 'needs-redeck' }, 'flat: insulation waits on a redeck')
assert.deepEqual(offered('attic-insulation', 'flat', [roofTorchDown, roofRedeck]).scopeIds, [atticInsulationTopOff], 'flat with a redeck: insulation offered, a top off over the unknown')
assert.deepEqual(keep([roofTorchDown, roofRedeck, radiantBarrier, airSealing, atticInsulationTopOff], 'flat'), [roofTorchDown, roofRedeck, atticInsulationTopOff], 'flat drops every attic-only pick')
for (const part of ROOF_ATTIC.parts.filter(part => !partOffers(ID).find(offer => offer.partId === part.id)?.dependsOnRoof)) {
  for (const [id, material] of Object.entries(part.materials)) {
    assert.equal((material as { forms?: unknown }).forms, undefined, `${part.id} ${id}: a form limit sits on the part, not the material`)
  }
}

// No insulation is a level the rep can record, and it draws the attic floor bare.
const bareFacts = unset(profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel: 'none' }))
const bare = INFER_EXISTING_CONDITIONS['roof-attic'](bareFacts, resolveHomeMaterials(bareFacts))
assert.deepEqual(bare.parts['attic-insulation'], { material: null, condition: 'absent' })
assert.equal(bare.basis, 'recorded', 'none is a recorded level, not a guess')

// A flat roof's ceiling runs far hotter than a vented attic's, insulation alike, and colder on a winter night.
for (const climate of CLIMATES) {
  const ceilingOf = (roofType: 'shingle' | 'flat', weather: 'normal' | 'summer' | 'winter') => {
    const scene = resolveScene({ ...HOME_SCENE_DEFAULTS, property: profile({ yearBuilt: '1950-1978', roofType, insulationLevel: 'r11' }), weather, climate }, resolveTradeBillCuts())
    assert.ok(scene.heat)
    return scene.heat.readings.ceiling
  }
  assert.ok(ceilingOf('flat', 'summer') - ceilingOf('shingle', 'summer') >= 10, `${climate}: a flat summer ceiling reads at least 10 °F hotter`)
  assert.ok(ceilingOf('flat', 'normal') > ceilingOf('shingle', 'normal'), `${climate}: a flat ceiling is warmer on a mild day`)
  assert.ok(ceilingOf('flat', 'winter') < ceilingOf('shingle', 'winter'), `${climate}: a flat ceiling is colder on a winter night`)
}
assert.equal(homeHeat('inland', 'summer', { parts: [], form: 'pitched' }).readings.ceiling, 86, 'a pitched home with nothing on it reads the starting ceiling')

// alsoNewLabels.
const tearOffAlso = alsoNewLabels(ID, unset(profile({ roofType: 'shingle' })), roofTearOff)
assert.ok(tearOffAlso.includes('Synthetic underlayment'), 'a tear-off lists the underlayment')
for (const label of ['Architectural shingles', 'New solid decking', 'Solid decking']) {
  assert.ok(!tearOffAlso.includes(label), `a tear-off does not list "${label}"`)
}
const shakeAlso = alsoNewLabels(ID, unset(profile({ roofType: 'woodshake' })), roofTearOff)
assert.ok(shakeAlso.includes('Synthetic underlayment'))
for (const label of ['Architectural shingles', 'New solid decking', 'Solid decking']) {
  assert.ok(!shakeAlso.includes(label), `a wood-shake tear-off does not list "${label}"`)
}

// Verbs.
for (const id of Object.keys(SCOPE_INSTALLS)) {
  assert.ok((SCOPE_VERBS as Record<string, string>)[id], `${id}: has a verb`)
}

// repairsRows.
const homeOf = (property: PropertyProfile) => resolveHomeMaterials(unset(property))
const rows = repairsRows(profile({}), homeOf(profile({})))
assert.deepEqual(rows.map(row => row.material), ['roof', 'windows', 'exterior-paint', 'heating-cooling'])
assert.deepEqual(rows.map(row => row.trade), ['roof-and-gutters', 'windows-and-doors', 'exterior-paint-stucco-and-siding', 'hvac'])
assert.ok(rows.every(row => row.working > 0), 'a row has a working figure')
for (const [trade, figure] of Object.entries(REPAIRS_PER_YEAR) as [TradeSlug, number][]) {
  assert.ok(figure <= 0 || Object.values(HOME_MATERIALS).some(material => material.repairs && material.trade === trade), `${trade}: a working repairs figure has a row`)
}

// repairsFigure.
const overrides = { 'roof-and-gutters': 600 }
assert.equal(repairsFigure([{ trade: 'roof-and-gutters', wear: 'worn' }], overrides).monthly, 50)
assert.equal(repairsFigure([{ trade: 'roof-and-gutters', wear: null }], {}).byTrade['roof-and-gutters']?.value, 400, 'an unset wear counts as Worn')
const shingleProperty = profile({ roofType: 'shingle' })
const shingleFacts = unset(shingleProperty)
const savings = sceneSavings({
  resolved: [{ assembly: ROOF_ATTIC, existing: INFER_EXISTING_CONDITIONS[ID](shingleFacts, resolveHomeMaterials(shingleFacts)), parts: existingParts(ID, shingleFacts).map(part => (part.id === 'covering' ? { ...part, condition: 'installed' as const, material: 'cool-shingle' } : part)) }],
  home: homeOf(shingleProperty),
  climate: 'inland',
  proposedScopeIds: [roofTearOff],
  bills: HOME_SCENE_DEFAULTS.bills,
  repairsOverrides: overrides,
}, resolveTradeBillCuts())
assert.ok(Object.keys(savings.repairsByTrade).length > 0, 'the savings credit a trade')
assert.equal(savings.repairsMonthly, repairsFigure(Object.keys(savings.repairsByTrade).map(trade => ({ trade: trade as TradeSlug, wear: 'worn' as const })), overrides).monthly)

// propertyPatch.
const shingleState = { property: profile({ roofType: 'shingle' }), homeMaterials: HOME_MATERIAL_FACTS_UNSET, efficiencyUpgrades: ['cool-roof' as const], proposedScopeIds: [roofTearOff, roofRedeck, radiantBarrier] }
assert.deepEqual(propertyPatch(shingleState, { roofType: 'metal' }, YEAR).proposedScopeIds, [radiantBarrier])
assert.deepEqual(propertyPatch(shingleState, { roofType: null }, YEAR).proposedScopeIds, [radiantBarrier])
assert.deepEqual(propertyPatch(shingleState, { roofType: 'woodshake' }, YEAR).proposedScopeIds, [roofTearOff, radiantBarrier])
assert.deepEqual(propertyPatch(shingleState, { hvacType: 'central' }, YEAR).proposedScopeIds, shingleState.proposedScopeIds, 'a write that changes nothing offered keeps every pick')
assert.equal(propertyPatch(shingleState, { roofType: 'metal' }, YEAR).property.roofType, 'metal')
assert.deepEqual(propertyPatch({ property: profile({ roofType: 'flat' }), homeMaterials: HOME_MATERIAL_FACTS_UNSET, efficiencyUpgrades: ['cool-roof'], proposedScopeIds: [roofTorchDown, roofRedeck] }, { roofType: 'shingle' }, YEAR).proposedScopeIds, [])

// scopePick.
const pickState = (patch: Partial<TradeSceneInputs> = {}): TradeSceneInputs => ({ ...HOME_SCENE_DEFAULTS, property: profile({ roofType: 'shingle' }), ...patch })
const pickOf = (partId: string) => offerOf(partId)
function pick(state: TradeSceneInputs, partId: string, picked: ScopeId | null): TradeSceneInputs {
  return { ...state, ...scopePick(state, pickOf(partId), picked) }
}
const coveringId = partOffers(ID).find(offer => (offer.scopeIds as string[]).includes(roofTearOff))!.partId
let walk = pick(pickState(), coveringId, roofTearOff)
assert.deepEqual(HOME_SCENE_DEFAULTS.efficiencyUpgrades, ['cool-roof', 'cool-paint'], 'every roof and repaint pick starts on the upgrade')
assert.deepEqual(walk.efficiencyUpgrades, ['cool-roof', 'cool-paint'], 'a covering pick leaves the upgrades as they were')
walk = { ...walk, ...efficiencyUpgradePatch(walk, 'cool-roof', false) }
assert.deepEqual(walk.efficiencyUpgrades, ['cool-paint'], 'the chip turns the cool roof off')
walk = pick(walk, coveringId, roofOverlay)
assert.deepEqual(walk.efficiencyUpgrades, ['cool-paint'], 'and a later covering pick does not turn it back on')
walk = { ...walk, ...efficiencyUpgradePatch(walk, 'cool-roof', true) }
assert.deepEqual(walk.efficiencyUpgrades, ['cool-paint', 'cool-roof'], 'the chip turns it on again')
// Cool Life paint walk: the repaint pick is the scope the switch names, and it survives an unpick and a repick.
const paintOffer = partOffers('exterior-wall').find(offer => offer.partId === 'paint')!
const paintPick = (state: TradeSceneInputs, picked: ScopeId | null): TradeSceneInputs => ({ ...state, ...scopePick(state, paintOffer, picked) })
let paintWalk = pickState({ property: profile({ roofType: 'shingle' }) })
paintWalk = paintPick(paintWalk, SCOPE_IDS.coolLifeRepaint)
assert.deepEqual(paintWalk.proposedScopeIds, [SCOPE_IDS.coolLifeRepaint], 'picking Repaint with the switch on holds the Cool Life scope')
paintWalk = { ...paintWalk, ...applySceneChange(paintWalk, { kind: 'efficiency-upgrade', upgrade: 'cool-paint', on: false }, YEAR) }
assert.deepEqual(paintWalk.proposedScopeIds, [SCOPE_IDS.waterBasedRepaint], 'switching Cool Life paint off swaps the pick')
paintWalk = paintPick(paintWalk, null)
assert.deepEqual(paintWalk.proposedScopeIds, [])
paintWalk = paintPick(paintWalk, SCOPE_IDS.coolLifeRepaint)
assert.deepEqual(paintWalk.proposedScopeIds, [SCOPE_IDS.waterBasedRepaint], 'a repick keeps the water-based scope')
assert.ok(!paintWalk.efficiencyUpgrades.includes('cool-paint'), 'with Cool Life paint still off')
walk = pick(walk, coveringId, roofTearOff)
walk = pick(walk, 'deck', roofRedeck)
assert.deepEqual(walk.proposedScopeIds, [roofTearOff, roofRedeck])
assert.deepEqual(pick(walk, coveringId, roofOverlay).proposedScopeIds, [roofOverlay], 'overlay drops the redeck')
assert.deepEqual(pick(walk, coveringId, null).proposedScopeIds, [], 'no change on the covering drops the redeck')
const insulation = pick(pickState(), 'attic-insulation', atticInsulationReplacement)
assert.deepEqual(pick(insulation, 'attic-insulation', atticInsulationTopOff).proposedScopeIds, [atticInsulationTopOff])
for (const view of ['existing', 'proposed'] as const) {
  assert.ok(!('view' in scopePreviewPatch(pickState({ view }), [roofTearOff], [roofTearOff])), `a pick on ${view} writes no view`)
}

// Offers and writes across every assembly.
const state = (patch: Partial<TradeSceneInputs>) => ({ ...HOME_SCENE_DEFAULTS, ...patch })
const sixties = profile({ yearBuilt: '1950-1978', roofType: 'shingle', hvacType: 'central', windowsType: 'single' })
const picked = state({ property: sixties, proposedScopeIds: [SCOPE_IDS.windowReplacement] })
const newWindows = homeMaterialPatch(picked, { kind: 'wear', id: 'windows', wear: 'new' }, YEAR)
assert.deepEqual(newWindows.proposedScopeIds, [], 'New drops its pick in the same write')
const facts = (s: TradeSceneInputs): HomeFacts => ({ property: s.property, materials: s.homeMaterials, year: YEAR })
const windowsRow = (s: TradeSceneInputs) => upgradeRows(facts(s), s.proposedScopeIds, s.efficiencyUpgrades).find(system => system.id === 'windows')!.rows[0]!
assert.equal(windowsRow(state({ ...picked, ...newWindows })).blocked, 'already-new')
const rated = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'good' } } })
assert.equal(homeMaterialPatch(rated, { kind: 'option', field: 'windowsType', value: 'double' }, YEAR).homeMaterials?.wear.windows, undefined, 'a new material clears its wear')
const same = homeMaterialPatch(rated, { kind: 'option', field: 'windowsType', value: 'single' }, YEAR)
assert.equal((same.homeMaterials ?? rated.homeMaterials).wear.windows, 'good', 'the same value keeps it')
const eraBack = homeMaterialPatch(state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, gutters: 'none', wear: { roof: 'good' } } }), { kind: 'era-guess', id: 'roof' }, YEAR)
assert.equal({ ...sixties, ...eraBack.property }.roofType, 'shingle', 'back to the era guess never clears the roof type')
assert.equal(eraBack.homeMaterials?.gutters, 'none', 'nor the gutters')
assert.equal(eraBack.homeMaterials?.wear.roof, undefined, 'it clears the wear')
const paint = (f: HomeFacts) => resolveHomeMaterials(f)['exterior-paint']
const none = { cracks: 'none', stains: 'none', peeling: 'none' }
assert.deepEqual(paintWearInForce(paint(unset(sixties)), {}), PAINT_WEAR_START.failing, 'an unset 1950-1978 paint takes its era guess')
const replaced = { ...HOME_MATERIAL_FACTS_UNSET, exteriorPaint: 'cool' } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: replaced, year: YEAR }), {}), PAINT_WEAR_START.worn, 'no wear and no era guess reads as Worn')
const fair = { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'exterior-paint': 'fair' } } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: fair, year: YEAR }), { stains: 'heavy' }), { cracks: 'light', stains: 'heavy', peeling: 'none' })
const fresh = { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'exterior-paint': 'new' } } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: fresh, year: YEAR }), { stains: 'heavy' }), none, 'new paint draws nothing')
assert.deepEqual(paintWearInForce(undefined, { stains: 'heavy' }), none, 'no paint, no marks')
for (const kind of paintWearKinds) {
  const steps = wears.map(wear => paintWearLevels.indexOf(PAINT_WEAR_START[wear][kind]))
  assert.ok(steps.every((step, index) => index === 0 || step >= steps[index - 1]), `${kind} never gets better as the paint wears`)
}
const wornPaint = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'exterior-paint': 'worn' } } })
const withStains = state({ ...wornPaint, ...homeMaterialPatch(wornPaint, { kind: 'fact', patch: { paintWear: { stains: 'heavy' } } }, YEAR) })
assert.deepEqual(withStains.homeMaterials.paintWear, { stains: 'heavy' })
assert.deepEqual(withStains.homeMaterials.wear, { 'exterior-paint': 'worn' }, 'a level write leaves the wear')
const withTwo = state({ ...withStains, ...homeMaterialPatch(withStains, { kind: 'fact', patch: { paintWear: { stains: 'heavy', cracks: 'light' } } }, YEAR) })
assert.deepEqual(withTwo.homeMaterials.paintWear, { stains: 'heavy', cracks: 'light' })
let walked = withStains
for (const wear of ['failing', 'new', 'worn'] as const) {
  walked = state({ ...walked, ...homeMaterialPatch(walked, { kind: 'wear', id: 'exterior-paint', wear }, YEAR) })
  assert.deepEqual(walked.homeMaterials.paintWear, { stains: 'heavy' }, `a wear change to ${wear} keeps the levels`)
}
assert.deepEqual(homeMaterialPatch(withStains, { kind: 'option', field: 'exteriorPaint', value: 'cool' }, YEAR).homeMaterials?.paintWear, { stains: 'heavy' }, 'a paint option change keeps the levels')
assert.deepEqual(homeMaterialPatch(withStains, { kind: 'era-guess', id: 'exterior-paint' }, YEAR).homeMaterials?.paintWear, {}, 'back to the era guess clears the levels')
assert.deepEqual(homeMaterialPatch(withStains, { kind: 'era-guess', id: 'roof' }, YEAR).homeMaterials?.paintWear, { stains: 'heavy' }, 'another material keeps them')
assert.deepEqual(propertyPatch(withStains, { yearBuilt: '1978-1998' }, YEAR).homeMaterials?.paintWear ?? withStains.homeMaterials.paintWear, { stains: 'heavy' }, 'a new era keeps the levels')
const newRoofNoGutters = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, gutters: 'none', wear: { roof: 'new' } } })
const gutterRow = upgradeRows(facts(newRoofNoGutters), [], newRoofNoGutters.efficiencyUpgrades).find(system => system.id === 'roof')!.rows.find(row => row.offer.partId === 'gutter')!
assert.notEqual(gutterRow.blocked, 'already-new', 'a New roof with no gutters can still be offered gutters')
const ductsOffer = partOffers('hvac-attic').find(offer => offer.partId === 'duct-runs')!
const ductsDropped = scopePick(state({ property: sixties, proposedScopeIds: [SCOPE_IDS.airDuctsReplacement], efficiencyUpgrades: ['cool-roof', 'r8-ducts'] }), ductsOffer, null)
assert.deepEqual(ductsDropped.efficiencyUpgrades, ['cool-roof'], 'dropping the ducts drops R-8, never the cool roof')
const offeredOnce = new Map<string, number>()
for (const system of HOME_SYSTEMS) {
  for (const row of system.rows) {
    offeredOnce.set(`${row.assembly}:${row.part}`, (offeredOnce.get(`${row.assembly}:${row.part}`) ?? 0) + 1)
  }
}
for (const assemblyId of ASSEMBLY_IDS) {
  for (const offer of partOffers(assemblyId)) {
    assert.equal(offeredOnce.get(`${assemblyId}:${offer.partId}`), 1, `${assemblyId} ${offer.partId}: in exactly one system row`)
  }
}
const wallUnit = propertyPatch(state({ property: sixties, proposedScopeIds: [SCOPE_IDS.splitSystemReplacement, SCOPE_IDS.airDuctsReplacement] }), { hvacType: 'wall-mounted' }, YEAR)
assert.deepEqual(wallUnit.proposedScopeIds, [], 'a wall unit drops the system and duct picks')
const r8Ducts = state({ property: sixties, proposedScopeIds: [SCOPE_IDS.airDuctsReplacement], efficiencyUpgrades: ['cool-roof', 'r8-ducts'] })
assert.deepEqual(propertyPatch(r8Ducts, { hvacType: 'wall-mounted' }, YEAR).efficiencyUpgrades, ['cool-roof'], 'a wall unit takes the ducts pick and its R-8')
assert.deepEqual(homeMaterialPatch(r8Ducts, { kind: 'wear', id: 'ducts', wear: 'new' }, YEAR).efficiencyUpgrades, ['cool-roof'], 'New ducts take the pick and its R-8')
assert.deepEqual(propertyPatch(r8Ducts, { hvacType: 'central' }, YEAR).efficiencyUpgrades, ['cool-roof', 'r8-ducts'], 'a kept ducts pick keeps its R-8')
const goodWindows = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'good' } } })
assert.equal(propertyPatch(goodWindows, { windowsType: 'double' }, YEAR).homeMaterials.wear.windows, undefined, 'a property write of a new window type clears the wear')
assert.equal(propertyPatch(goodWindows, { windowsType: 'single' }, YEAR).homeMaterials.wear.windows, 'good', 'the same window type keeps it')
// A wear set without recording the option stays when the era moves its guess: the option follows the era, the wear is the rep's.
const eraWear = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'windows': 'good', 'attic-insulation': 'good', 'ducts': 'good' } } })
const eraMoved = propertyPatch(eraWear, { yearBuilt: 'Post-2014' }, YEAR)
assert.deepEqual(eraMoved.homeMaterials.wear, { 'windows': 'good', 'attic-insulation': 'good', 'ducts': 'good' }, 'an era change keeps a wear the rep set')
const eraOnly = state({ property: { ...sixties, windowsType: null }, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'good' } } })
assert.equal(propertyPatch(eraOnly, { yearBuilt: 'Post-2014' }, YEAR).homeMaterials.wear.windows, 'good', 'a windows wear set without a recorded type survives an era change')
const levelWear = state({ property: { ...sixties, insulationLevel: 'r11' }, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'attic-insulation': 'good' } } })
assert.equal(propertyPatch(levelWear, { insulationLevel: 'r30' }, YEAR).homeMaterials.wear['attic-insulation'], undefined, 'an explicit insulation level that moves the option clears its wear')
assert.equal(propertyPatch(levelWear, { insulationLevel: 'r11' }, YEAR).homeMaterials.wear['attic-insulation'], 'good', 'the same level keeps it')
const unitGroup = upgradeRows({ property: { ...sixties, hvacType: 'wall-mounted' }, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'heating-cooling')!
assert.deepEqual(unitGroup.rows.map(row => row.blocked), ['no-offer-for-unit'])
const packageGroup = upgradeRows({ property: { ...sixties, hvacType: 'package-unit', hvacComponents: 'furnace' }, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'heating-cooling')!
assert.deepEqual(packageGroup.rows.map(row => row.offer.partId), ['package-unit', 'duct-runs'], 'a package unit: its own row, no split system')
for (const roofType of roofTypes) {
  const covering = upgradeRows({ property: profile({ roofType }), materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'roof')?.rows.find(row => row.offer.partId === 'covering')
  assert.deepEqual(covering?.scopeIds ?? [], SCOPES_BY_EXISTING_ROOF[roofType].filter(id => SCOPE_INSTALLS[id]!.installs[0]!.part === 'covering'), `R81 holds for ${roofType}`)
}
assert.equal(windowsRow(state({ property: sixties })).kinds[SCOPE_IDS.windowReplacement], 'saves-energy')
assert.equal(windowsRow(state({ property: { ...sixties, windowsType: 'double' } })).kinds[SCOPE_IDS.windowReplacement], 'like-for-like')
const roofRow = (efficiencyUpgrades: EfficiencyUpgradeId[]) => upgradeRows(facts(state({ property: sixties })), [], efficiencyUpgrades).find(system => system.id === 'roof')!.rows.find(row => row.offer.partId === 'covering')!
assert.equal(roofRow(['cool-roof']).kinds[SCOPE_IDS.roofTearOff], 'saves-energy')
assert.equal(roofRow([]).kinds[SCOPE_IDS.roofTearOff], 'like-for-like', 'cool off: like for like')

const at = (open: ControlsSection | null, focus: SystemsFocus = null, view: 'existing' | 'proposed' = 'existing') => ({ open, focus, view })
assert.deepEqual(pressSection(at('facts'), 'facts'), { ...at(null), toast: false }, 'pressing the open section closes it')
assert.deepEqual(pressSection(at('systems', 'roof'), 'modify'), { ...at('modify'), toast: false }, 'leaving Systems lets the system go')
assert.deepEqual(pressSection(at(null), 'benefits'), { ...at('benefits', null, 'proposed'), toast: true }, 'Benefits on Today flips first')
assert.deepEqual(pressSection(at(null, null, 'proposed'), 'benefits'), { ...at('benefits', null, 'proposed'), toast: false })
assert.deepEqual(flipView(at('benefits', null, 'proposed')), { ...at(null), toast: false }, 'flipping to Today closes Benefits')
assert.deepEqual(flipView(at('systems', 'roof')), { ...at('systems', 'roof', 'proposed'), toast: false }, 'a flip keeps the system in focus')
assert.deepEqual(pressFocus(at('systems', 'roof'), 'roof'), { ...at('systems'), toast: false }, 'the same system again lets it go')
assert.deepEqual(pressFocus(at('systems', 'roof'), 'attic'), { ...at('systems', 'attic'), toast: false })
assert.equal(stageShapeOf(1440, 900), 'landscape')
assert.equal(stageShapeOf(768, 700), 'narrow')
assert.equal(stageShapeOf(820, 1180), 'portrait')
assert.equal(stageShapeOf(764, 1000), 'portrait')
assert.equal(stageShapeOf(390, 844), 'portrait')
assert.equal(stageShapeOf(599, 300), 'portrait')
const area = (shape: StageShape, width: number, height: number, focusCardBottom: number | null = null) => sceneVisibleAreaFor({ shape, width, height, focusCardBottom })
assert.deepEqual(area('landscape', 1180, 820), { left: 0, right: 94, bottom: 80, top: 0 })
assert.deepEqual(area('portrait', 390, 844), { left: 0, right: 94, bottom: 76, top: 0 })
assert.deepEqual(area('landscape', 1180, 820, 400), { left: 0, right: 94 + 10 + 440, bottom: 80, top: 0 }, 'the card beside the system')
assert.deepEqual(area('portrait', 390, 844, 260), { left: 0, right: 94, bottom: 76, top: 260 + 12 }, 'the system below its card')
assert.deepEqual(area('narrow', 760, 560, 220), { left: 0, right: 94, bottom: 80, top: 220 + 12 }, 'a narrow stage has no room beside the system, so it frames it below its card')
// Up close is the same card holding its system's parts, so the area has nothing of its own to ask: the card's measured
// bottom is all that moves it, and on portrait the card stops at its share of the stage, the system still in sight below.
for (const [shape, width, height, bottom] of [['landscape', 1180, 820, 520], ['narrow', 760, 560, 280], ['portrait', 390, 844, 422]] as const) {
  // @ts-expect-error up close asks nothing of its own of the area
  const upCloseArea = sceneVisibleAreaFor({ shape, width, height, focusCardBottom: bottom, lookInside: true })
  assert.deepEqual(upCloseArea, area(shape, width, height, bottom), `${shape}: up close frames the system as its focus does`)
}
const cardCap = Math.round(844 * SCENE_LAYOUT.systemCard.topShare)
const upClose = area('portrait', 390, 844, SCENE_LAYOUT.systemCard.portraitTop + cardCap)
assert.ok(844 - upClose.top - upClose.bottom >= 260, `up close on a phone the system keeps ${844 - upClose.top - upClose.bottom} px below the tallest card`)
assert.deepEqual(area('portrait', 0, 0), { left: 0, right: 0, bottom: 0, top: 0 })
// On portrait the weather always folds; otherwise the dock folds only as far as the room above the band asks. On portrait
// the dock's region stops above the keys button's corner whether the button shows.
assert.equal(dockHeightFor('none'), 414, 'the home view, Thermal and four weathers, with both dividers')
assert.equal(dockHeightFor('weather'), 200)
assert.equal(dockLayoutFor({ shape: 'landscape', stage: { width: 1440, height: 900 } }), 'none')
assert.equal(dockLayoutFor({ shape: 'landscape', stage: { width: 1024, height: 690 } }), 'none', 'an iPad inside the browser\'s bars keeps every weather')
assert.equal(dockLayoutFor({ shape: 'landscape', stage: { width: 1024, height: 560 } }), 'none', 'the build switch\'s room is the dock\'s now')
assert.equal(dockLayoutFor({ shape: 'landscape', stage: { width: 1024, height: 480 } }), 'weather')
assert.equal(dockLayoutFor({ shape: 'portrait', stage: { width: 820, height: 1180 } }), 'weather', 'a portrait stage folds the weather even with room for the strip')
assert.equal(dockLayoutFor({ shape: 'portrait', stage: { width: 375, height: 667 } }), 'weather', 'the shortest phone still fits the folded strip above the keys corner')
const { keysButton } = SCENE_LAYOUT
assert.deepEqual(dockRegionFor('portrait', { width: 390, height: 844 }), { top: 16, bottom: 76 + keysButton.gap + keysButton.size + keysButton.spacing }, 'above the keys button, which sits on the band')
assert.deepEqual(dockRegionFor('landscape', { width: 1440, height: 900 }), { top: 16, bottom: 80 }, 'the build switch\'s room is freed; the dock stays above the band')

// The shortcut-keys dialog is the one place every key is listed, so each key the stage handles has a line, once.
const sheetKeys: string[] = SHORTCUT_SHEET_ROWS.flatMap(row => [...row.keys])
assert.deepEqual([...sheetKeys].sort(), Object.keys(SCENE_SHORTCUTS).sort(), 'the dialog lists every shortcut key once, and no other')
assert.ok(sheetKeys.includes('m') && !sheetKeys.includes('/'), 'the sheet lists M and no slash')
assert.equal(SCENE_SHORTCUTS.m, 'modify', 'M opens Modify')
assert.equal(SHORTCUT_COPY.lines.modify, 'Modify: search a change')
assert.equal(SCENE_SHORTCUTS.escape, 'wholeHome', 'Escape steps back toward the whole home')
assert.equal(SHORTCUT_COPY.lines.wholeHome, 'Step back: a menu, a Benefits detail, Look inside, the system, then the window', 'the sheet names the order Escape steps back in')
assert.equal(SCENE_SHORTCUTS.r, 'recenter', 'R glides the camera back to the framing')
assert.equal(SHORTCUT_COPY.lines.recenter, 'Recenter the camera')
assert.equal(SCENE_COPY.recenter, 'Recenter')

console.log('✓ trade scene layout')
