import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, HouseWall, SceneChangeSlot, SceneChangeSlotId, TradeSceneInputs, Vec3 } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { Assembly, ExistingConditions, HomeFacts, HomeMaterialFacts, PropertyProfile, ResolvedPart, ScopeInstall, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { CONDENSER_LINE_SET, THERMOSTAT_BOX } from '@/features/trade-scenes/constants/home-details'
import { FURNISHING_BOXES, HOME_FURNITURE } from '@/features/trade-scenes/constants/home-furnishings'
import { ATTIC_SPANS, BACK_INNER, EQUIPMENT, HOME_FLOOR_Y, HOME_ORBIT, HOUSE, HOUSE_WALLS, MINI_SPLIT_HEAD_SIZE, MINI_SPLIT_HEADS, MINI_SPLIT_LINE_SIZE, MINI_SPLIT_OUTDOOR, PARTITION_DOOR, PARTITIONS_X, ROOMS, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LOT } from '@/features/trade-scenes/constants/home-lot'
import { HVAC_COMPONENT_LABELS, HVAC_INDOOR_LOCATION_LABELS, HVAC_SYSTEM_CHOICE_LABELS, MINI_SPLIT_HEAD_COUNT_LABELS, PART_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { HVAC_SYSTEM_CHOICES } from '@/features/trade-scenes/constants/home-systems'
import { INDOOR_UNIT_LOOK, INDOOR_UNIT_PLACEMENTS } from '@/features/trade-scenes/constants/indoor-unit-placements'
import { LOOK_INSIDE, PART_PIECES } from '@/features/trade-scenes/constants/look-inside'
import { lookInsideView, partLookInsideView, SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { DETAILS_SWITCH } from '@/features/trade-scenes/constants/work-details-switches'
import { applySceneChange } from '@/features/trade-scenes/lib/apply-scene-change'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { drawnHvac } from '@/features/trade-scenes/lib/drawn-hvac'
import { ductRunPoints } from '@/features/trade-scenes/lib/duct-run-points'
import { emphasizedParts } from '@/features/trade-scenes/lib/emphasized-parts'
import { hasDucts } from '@/features/trade-scenes/lib/has-ducts'
import { homeHeatLanes } from '@/features/trade-scenes/lib/home-heat-lanes'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { hvacFocusOf } from '@/features/trade-scenes/lib/hvac-focus-of'
import { hvacRunning, indoorAirZone, runningZone } from '@/features/trade-scenes/lib/hvac-running'
import { hvacSystemChoice, hvacSystemPatch } from '@/features/trade-scenes/lib/hvac-system-choice'
import { atticHoldsUnit, indoorLocation, moveToAtticOffered } from '@/features/trade-scenes/lib/indoor-location'
import { indoorSide } from '@/features/trade-scenes/lib/indoor-side'
import { indoorUnitBoxes, indoorUnitLineSet, indoorUnitReturnDuct, indoorUnitTrunk } from '@/features/trade-scenes/lib/indoor-unit-boxes'
import { indoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import { keepEfficiencyUpgrades } from '@/features/trade-scenes/lib/keep-efficiency-upgrades'
import { homeSpotContext } from '@/features/trade-scenes/lib/keep-look-inside'
import { listedRows } from '@/features/trade-scenes/lib/listed-rows'
import { miniSplitHeadCount } from '@/features/trade-scenes/lib/mini-split-head-count'
import { lineSetBoxes, miniSplitLineSet } from '@/features/trade-scenes/lib/mini-split-line-set'
import { packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'
import { partRowWord } from '@/features/trade-scenes/lib/part-row-word'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { roomAt } from '@/features/trade-scenes/lib/room-at'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { resolveInputsOf, selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { sceneRoofForm } from '@/features/trade-scenes/lib/scene-roof-form'
import { scopePick } from '@/features/trade-scenes/lib/scope-pick'
import { searchSceneChanges } from '@/features/trade-scenes/lib/search-scene-changes'
import { systemLit } from '@/features/trade-scenes/lib/system-lit'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'
import { systemPartOpacity } from '@/features/trade-scenes/lib/system-part-opacity'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { systemPartRows } from '@/features/trade-scenes/lib/system-parts-shown'
import { canLookInside, systemsAtSpot } from '@/features/trade-scenes/lib/systems-at-spot'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { workDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { hvacIndoorLocations, miniSplitHeadCounts, roofTypes } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { UPGRADE_REGISTRY } from '@/shared/modules/construction/core/constants/upgrade-registry'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
import { billsPaid } from '@/shared/modules/construction/core/lib/bills-paid'
import { centralComponents } from '@/shared/modules/construction/core/lib/hvac-system'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'
import { scopeFitsHome } from '@/shared/modules/construction/core/lib/scope-fits-home'

const copy = { label: 'x', detail: '' }
const fixture: Assembly = {
  id: 'hvac-attic',
  trades: ['hvac'],
  modes: {},
  parts: [
    { id: 'a', group: 'g', role: 'equipment', noCutWhereNone: true, materials: { old: { copy, energyRank: 0 }, new: { copy, energyRank: 1, bills: ['electric'] } } },
    { id: 'b', group: 'g', role: 'equipment', materials: { old: { copy, energyRank: 0 }, new: { copy, energyRank: 1 } } },
  ],
} as unknown as Assembly
const [partA, partB] = fixture.parts
const installsFor = (parts: ScopeInstall['installs'], extra: Partial<ScopeInstall> = {}): Partial<Record<string, ScopeInstall>> => ({ s: { assembly: 'hvac-attic', trade: 'hvac', installs: parts, ...extra } })
function homeWith(a: 'old' | null, b: 'old' | null): ExistingConditions {
  return {
    form: null,
    basis: 'typical',
    parts: {
      a: a === null ? { material: null, condition: 'absent' } : { material: a, condition: 'retained' },
      b: b === null ? { material: null, condition: 'absent' } : { material: b, condition: 'retained' },
    },
  }
}

// A part the home never had earns no cut when it asks for that
assert.equal(installKind(partA, null, 'new'), 'like-for-like', 'a part the home never had earns no cut')
assert.equal(installKind(partA, 'old', 'new'), 'saves-energy')
assert.equal(installKind(partB, null, 'new'), 'saves-energy', 'without the flag today\'s rule stands')

// A part installed where the home had none is marked added
const added = resolveAssembly(fixture, { existing: homeWith(null, 'old'), proposedScopeIds: ['s'], view: 'proposed' }, installsFor([{ part: 'a', material: 'new' }, { part: 'b', material: 'new' }]))
assert.equal(added.find(part => part.id === 'a')?.added, true, 'a part installed where the home had none is added')
assert.equal(added.find(part => part.id === 'b')?.added, undefined, 'a part that replaces one is not added')
const existingView = resolveAssembly(fixture, { existing: homeWith(null, 'old'), proposedScopeIds: ['s'], view: 'existing' }, installsFor([{ part: 'a', material: 'new' }]))
assert.equal(existingView.find(part => part.id === 'a')?.added, undefined, 'the existing view adds nothing')

// A scope is offered only where the home has or lacks the named parts
const resolved = (a: 'old' | null, b: 'old' | null): ResolvedPart[] => resolveAssembly(fixture, { existing: homeWith(a, b), proposedScopeIds: [], view: 'existing' }, {})
const entry = (onlyWhere?: ScopeInstall['onlyWhere']): ScopeInstall => ({ assembly: 'hvac-attic', trade: 'hvac', installs: [{ part: 'a', material: 'new' }], ...(onlyWhere ? { onlyWhere } : {}) })
assert.equal(scopeFitsHome(entry({ has: ['b'] }), resolved(null, 'old')), true, 'a replacement fits a home that has what it replaces')
assert.equal(scopeFitsHome(entry({ has: ['b'] }), resolved('old', null)), false, 'and not one that lacks it')
assert.equal(scopeFitsHome(entry({ lacks: ['a'] }), resolved(null, 'old')), true, 'a first install fits a home without the part')
assert.equal(scopeFitsHome(entry({ lacks: ['a'] }), resolved('old', 'old')), false, 'and not one that has it')
assert.equal(scopeFitsHome(entry(), resolved(null, null)), true, 'a scope with no condition fits any home')

// The real assemblies mark an install on a home with none
const facts = { property: { ...HOME_SCENE_DEFAULTS.property, roofType: 'shingle' as const }, materials: HOME_MATERIAL_FACTS_UNSET, year: 2026 }
const roofExisting = inferRoofAtticExistingConditions(facts, resolveHomeMaterials(facts))
const roofWith = (scopes: string[]) => resolveAssembly(ASSEMBLIES['roof-attic'], { existing: roofExisting, proposedScopeIds: scopes, view: 'proposed' })
assert.equal(roofWith([SCOPE_IDS.radiantBarrier]).find(part => part.id === 'radiant-barrier')?.added, true, 'a radiant barrier on a home with none is added')
assert.equal(roofWith([SCOPE_IDS.roofTearOff]).find(part => part.id === 'covering')?.added, undefined, 'a new covering over an old one is not added')

// The indoor unit is its components, and every home has heating & cooling
interface SceneOptions { scopes?: string[], view?: TradeSceneInputs['view'], weather?: Weather, materials?: Partial<HomeMaterialFacts>, efficiencyUpgrades?: EfficiencyUpgradeId[] }
function scene(property: Partial<PropertyProfile>, { scopes = [], view = 'existing', weather = 'normal', materials = {}, efficiencyUpgrades = HOME_SCENE_DEFAULTS.efficiencyUpgrades }: SceneOptions = {}) {
  const state: TradeSceneInputs = { ...HOME_SCENE_DEFAULTS, property: { ...HOME_SCENE_DEFAULTS.property, ...property }, proposedScopeIds: scopes, view, weather, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, ...materials }, efficiencyUpgrades }
  return resolveScene(resolveInputsOf(selectResolveInputs(state)), resolveTradeBillCuts(), 2026)
}
const hvacPartsOf = (targets: ReturnType<typeof scene>) => targets.assemblies['hvac-attic']?.parts ?? []
const presentIds = (property: Partial<PropertyProfile>) => hvacPartsOf(scene(property)).filter(part => part.condition !== 'absent').map(part => part.id)
const near = (actual: number, expected: number, message: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} is not ${expected}`)

const centralBoth = ['registers', 'return', 'blower', 'furnace', 'coil', 'plenum', 'duct-runs', 'thermostat', 'refrigerant-lines', 'condenser']
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'both' }), centralBoth, 'a central furnace and A/C has every split component')
assert.deepEqual(presentIds({}), centralBoth, 'an unknown system is a central furnace and A/C')
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'furnace' }), ['registers', 'return', 'blower', 'furnace', 'plenum', 'duct-runs', 'thermostat'], 'a furnace alone has no coil, line set or condenser')
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'ac' }), centralBoth, 'a central system stored as A/C alone has its furnace too')
assert.deepEqual(presentIds({ hvacType: 'wall-mounted' }), ['thermostat'], 'a wall unit has only its thermostat in the assembly')
assert.deepEqual(presentIds({ hvacType: 'portable' }), ['thermostat'], 'a window unit has only its thermostat in the assembly')
assert.deepEqual(presentIds({ hvacType: 'package-unit' }), ['registers', 'duct-runs', 'thermostat', 'package-unit'], 'a package unit feeds ducts and registers')
assert.deepEqual(presentIds({ hvacType: 'mini-split' }), ['thermostat', 'mini-split-heads', 'mini-split-outdoor'], 'a mini-split home has its heads and outdoor unit')

const splitOn = (property: Partial<PropertyProfile>, extra: string[] = []) => scene(property, { scopes: [SCOPE_IDS.splitSystemReplacement, ...extra], view: 'proposed' }).savings.cuts
for (const [name, property] of [['unknown', {}], ['central both', { hvacType: 'central', hvacComponents: 'both' }]] as const) {
  const cuts = splitOn(property)
  near(cuts.electric.combined, 0.25, `${name}: split replacement cuts electric`)
  near(cuts.gas.combined, 0.2, `${name}: split replacement cuts gas`)
  const withDucts = splitOn(property, [SCOPE_IDS.airDuctsReplacement])
  near(withDucts.electric.combined, 0.2875, `${name}: new ducts add to the electric cut`)
  near(withDucts.gas.combined, 0.24, `${name}: new ducts add to the gas cut`)
}
const packageCuts = scene({ hvacType: 'package-unit' }, { scopes: [SCOPE_IDS.packageUnitReplacement], view: 'proposed' }).savings.cuts
near(packageCuts.electric.combined, 0.25, 'package replacement cuts electric')
near(packageCuts.gas.combined, 0.2, 'package replacement cuts gas')

const furnaceOnlyBuild = hvacPartsOf(scene({ hvacType: 'central', hvacComponents: 'furnace' }, { scopes: [SCOPE_IDS.splitSystemReplacement], view: 'proposed' }))
for (const id of ['coil', 'refrigerant-lines', 'condenser']) {
  assert.equal(furnaceOnlyBuild.find(part => part.id === id)?.added, true, `a furnace-only home gains its ${id}`)
}
for (const id of ['furnace', 'blower']) {
  assert.equal(furnaceOnlyBuild.find(part => part.id === id)?.added, undefined, `a furnace-only home's ${id} is replaced, not added`)
}

for (const hvacType of ['wall-mounted', 'portable', 'mini-split'] as const) {
  const today = scene({ hvacType })
  assert.equal(today.home.ducts, undefined, `${hvacType}: no ducts material`)
  assert.equal(hasDucts(hvacPartsOf(today)), false, `${hvacType}: no ducts drawn`)
}
for (const hvacType of [null, 'central', 'package-unit'] as const) {
  assert.equal(hasDucts(hvacPartsOf(scene({ hvacType }))), true, `${hvacType ?? 'unknown'}: ducts drawn`)
}
assert.equal(hasDucts(hvacPartsOf(scene({}, { scopes: [SCOPE_IDS.splitSystemReplacement], view: 'proposed' }))), true, 'the build keeps the ducts')

const ductRunDetail = (targets: ReturnType<typeof scene>) => hvacPartsOf(targets).find(part => part.id === 'duct-runs')?.detail ?? ''
assert.ok(ductRunDetail(scene({}, { scopes: [SCOPE_IDS.airDuctsReplacement], view: 'proposed' })).endsWith('supported the way code requires.'), 'new ducts say why they hang')
assert.ok(!ductRunDetail(scene({}, { materials: { ducts: 'r6-silver-flex' } })).endsWith('supported the way code requires.'), 'a home\'s own R-6 ducts are not hung')

// Every heating & cooling build draws what it installs and is offered only where it fits the home
const scopeName = Object.fromEntries(Object.entries(SCOPE_IDS).map(([name, id]) => [id, name]))
const inputs = (property: Partial<PropertyProfile>, patch: Partial<TradeSceneInputs> = {}): TradeSceneInputs => ({ ...HOME_SCENE_DEFAULTS, property: { ...HOME_SCENE_DEFAULTS.property, ...property }, ...patch })
const factsOf = (state: TradeSceneInputs): HomeFacts => ({ property: state.property, materials: state.homeMaterials, year: 2026 })
const hvacRows = (state: TradeSceneInputs) => upgradeRows(factsOf(state), state.proposedScopeIds, state.efficiencyUpgrades).find(system => system.id === 'heating-cooling')?.rows ?? []
const rowOf = (state: TradeSceneInputs, part: string) => hvacRows(state).find(row => row.part === part)!
const offersOf = (property: Partial<PropertyProfile>) => hvacRows(inputs(property)).map(row => ({ part: row.part, scopeIds: row.scopeIds.map(id => scopeName[id]) }))
const minis = { part: 'mini-split-heads', scopeIds: ['miniSplitInstallation', 'miniSplitKit'] }
const ducts = { part: 'duct-runs', scopeIds: ['airDuctsReplacement'] }
const offersTable: [string, Partial<PropertyProfile>, { part: string, scopeIds: string[] }[]][] = [
  ['central both', { hvacType: 'central', hvacComponents: 'both' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement', 'furnaceReplacement', 'heatPumpReplacement'] }, ducts, minis]],
  ['central furnace', { hvacType: 'central', hvacComponents: 'furnace' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'furnaceReplacement', 'heatPumpReplacement'] }, ducts, minis]],
  ['central ac', { hvacType: 'central', hvacComponents: 'ac' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement', 'furnaceReplacement', 'heatPumpReplacement'] }, ducts, minis]],
  ['unknown', { hvacType: null, hvacComponents: null }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement', 'furnaceReplacement', 'heatPumpReplacement'] }, ducts, minis]],
  ['wall-mounted', { hvacType: 'wall-mounted' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut', 'heatPumpNewCut'] }, minis]],
  ['portable', { hvacType: 'portable' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut', 'heatPumpNewCut'] }, minis]],
  ['mini-split', { hvacType: 'mini-split' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut', 'heatPumpNewCut'] }, minis]],
  ['package-unit', { hvacType: 'package-unit' }, [{ part: 'package-unit', scopeIds: ['packageUnitReplacement'] }, ducts, minis]],
]
for (const [name, property, expected] of offersTable) {
  assert.deepEqual(offersOf(property), expected, `${name}: the heating & cooling rows offer what fits the home`)
  for (const system of upgradeRows(factsOf(inputs(property)), [], [])) {
    for (const row of system.rows) {
      assert.ok(row.scopeIds.length > 0 || row.blocked !== null, `${name}: the ${row.part} row offers something or says why not`)
    }
  }
  const state = inputs(property)
  const targets = resolveScene(resolveInputsOf(selectResolveInputs(state)), resolveTradeBillCuts(), 2026)
  for (const buildSlot of sceneChangeSlots(state, targets, 2026).filter(candidate => candidate.id.startsWith('build:'))) {
    const labels = buildSlot.options.map(option => option.label)
    assert.equal(new Set(labels).size, labels.length, `${name}: ${buildSlot.id} names each job once`)
  }
}

const centralBothHome = inputs({ hvacType: 'central', hvacComponents: 'both' })
const splitPicked = inputs(centralBothHome.property, { proposedScopeIds: [SCOPE_IDS.splitSystemReplacement] })
assert.deepEqual(scopePick(splitPicked, rowOf(splitPicked, 'blower').offer, SCOPE_IDS.acReplacement).proposedScopeIds, [SCOPE_IDS.acReplacement], 'A/C replacement takes the place of a whole system')

const centralPicks = inputs(centralBothHome.property, { proposedScopeIds: [SCOPE_IDS.splitSystemReplacement, SCOPE_IDS.airDuctsReplacement] })
assert.deepEqual(propertyPatch(centralPicks, { hvacType: 'wall-mounted', hvacComponents: 'furnace' }, 2026).proposedScopeIds, [], 'a home that turns out to have a wall unit drops the system and ducts picks')
const newCutPicked = inputs({ hvacType: 'wall-mounted' }, { proposedScopeIds: [SCOPE_IDS.splitSystemNewCut] })
assert.deepEqual(propertyPatch(newCutPicked, { hvacType: 'central' }, 2026).proposedScopeIds, [], 'a home that turns out to be central drops a new system')

const wallHome = inputs({ hvacType: 'wall-mounted' })
assert.equal(upgradeRowState(rowOf(wallHome, 'blower'), [], []).holdsR8, true, 'a wall home\'s new system holds the R-8 step')
assert.equal(upgradeRowState(rowOf(centralBothHome, 'blower'), [], []).holdsR8, false, 'a central home\'s system row holds no R-8 step')
assert.equal(upgradeRowState(rowOf(centralBothHome, 'duct-runs'), [], []).holdsR8, true, 'a central home\'s ducts row holds it')
const newCutR8 = hvacPartsOf(scene({ hvacType: 'wall-mounted' }, { scopes: [SCOPE_IDS.splitSystemNewCut], view: 'proposed', efficiencyUpgrades: ['r8-ducts'] }))
assert.equal(newCutR8.find(part => part.id === 'duct-runs')?.material, 'r8-flex', 'a new system with R-8 lays R-8 ducts')

const withPatch = (state: TradeSceneInputs, patch: Partial<TradeSceneInputs>): TradeSceneInputs => ({ ...state, ...patch })
const newCutOn = withPatch(wallHome, scopePick(wallHome, rowOf(wallHome, 'blower').offer, SCOPE_IDS.splitSystemNewCut))
const r8On = withPatch(newCutOn, { efficiencyUpgrades: [...newCutOn.efficiencyUpgrades, 'r8-ducts'] })
const miniOn = withPatch(r8On, scopePick(r8On, rowOf(r8On, 'mini-split-heads').offer, SCOPE_IDS.miniSplitInstallation))
assert.ok(miniOn.efficiencyUpgrades.includes('r8-ducts'), 'a later pick keeps the new system\'s R-8')
const todayEdited = withPatch(miniOn, propertyPatch(miniOn, { hvacComponents: 'ac' }, 2026))
assert.ok(todayEdited.efficiencyUpgrades.includes('r8-ducts'), 'a Today edit keeps the new system\'s R-8')
const newCutOff = withPatch(todayEdited, scopePick(todayEdited, rowOf(todayEdited, 'blower').offer, null))
assert.ok(!newCutOff.efficiencyUpgrades.includes('r8-ducts'), 'unpicking the new system drops its R-8')

const newCutBuild = hvacPartsOf(scene({ hvacType: 'wall-mounted' }, { scopes: [SCOPE_IDS.splitSystemNewCut], view: 'proposed' }))
for (const id of ['return', 'blower', 'furnace', 'coil', 'plenum', 'duct-runs', 'registers', 'refrigerant-lines', 'condenser']) {
  const part = newCutBuild.find(candidate => candidate.id === id)
  assert.equal(part?.condition, 'installed', `a new system installs its ${id}`)
  assert.equal(part?.added, true, `a wall home gains its ${id}`)
}

// Cooling earns on the electric bill and heating on gas, new ducts land only on a bill the home pays both before and after
// the build, and no bill goes up
const split = SCOPE_IDS.splitSystemReplacement
const ductsScope = SCOPE_IDS.airDuctsReplacement
const centralBothProperty: Partial<PropertyProfile> = { hvacType: 'central', hvacComponents: 'both' }
const centralFurnaceProperty: Partial<PropertyProfile> = { hvacType: 'central', hvacComponents: 'furnace' }
const centralAcProperty: Partial<PropertyProfile> = { hvacType: 'central', hvacComponents: 'ac' }
const cutsTable: [string, Partial<PropertyProfile>, string[], number, number][] = [
  ['central both', centralBothProperty, [split], 0.25, 0.2],
  ['central both', centralBothProperty, [SCOPE_IDS.acReplacement], 0.25, 0],
  ['central both', centralBothProperty, [SCOPE_IDS.furnaceReplacement], 0, 0.2],
  ['central furnace', centralFurnaceProperty, [split], 0, 0.2],
  ['central ac', centralAcProperty, [split], 0.25, 0.2],
  ['central both', centralBothProperty, [split, ductsScope], 0.2875, 0.24],
  ['central furnace', centralFurnaceProperty, [split, ductsScope], 0, 0.24],
  ['central ac', centralAcProperty, [split, ductsScope], 0.2875, 0.24],
  ['central both', centralBothProperty, [SCOPE_IDS.acReplacement, ductsScope], 0.2875, 0.05],
  ['central both', centralBothProperty, [ductsScope], 0.05, 0.05],
  ['central furnace', centralFurnaceProperty, [ductsScope], 0, 0.05],
  ['wall-mounted', { hvacType: 'wall-mounted' }, [SCOPE_IDS.splitSystemNewCut], 0, 0],
  ['central both', centralBothProperty, [SCOPE_IDS.miniSplitInstallation], 0, 0],
  ['package-unit', { hvacType: 'package-unit' }, [SCOPE_IDS.packageUnitReplacement], 0.25, 0.2],
  ['package-unit', { hvacType: 'package-unit' }, [SCOPE_IDS.packageUnitReplacement, ductsScope], 0.2875, 0.24],
]
for (const [home, property, scopes, electric, gas] of cutsTable) {
  const cuts = scene(property, { scopes, view: 'proposed' }).savings.cuts
  const build = scopes.map(id => scopeName[id]).join(' + ')
  near(cuts.electric.combined, electric, `${home}, ${build}: the electric cut`)
  near(cuts.gas.combined, gas, `${home}, ${build}: the gas cut`)
  for (const category of ['electric', 'gas'] as const) {
    assert.ok(cuts[category].after <= cuts[category].bill, `${home}, ${build}: the ${category} bill never goes up`)
  }
}
const wallCuts = scene({ hvacType: 'wall-mounted' }, { scopes: [SCOPE_IDS.splitSystemNewCut], view: 'proposed', efficiencyUpgrades: ['r8-ducts'] }).savings.cuts
near(wallCuts.electric.combined, 0, 'a new system with R-8 ducts on a wall home: the electric cut')
near(wallCuts.gas.combined, 0, 'a new system with R-8 ducts on a wall home: the gas cut')

const todayParts = (property: Partial<PropertyProfile>) => hvacPartsOf(scene(property))
const hvacAssembly = ASSEMBLIES['hvac-attic']
assert.deepEqual([...billsPaid(todayParts(centralBothProperty), hvacAssembly) ?? []].sort(), ['electric', 'gas'], 'a central furnace and A/C pays both bills')
assert.deepEqual([...billsPaid(todayParts(centralFurnaceProperty), hvacAssembly) ?? []], ['gas'], 'a furnace alone pays gas')
assert.deepEqual([...billsPaid(todayParts(centralAcProperty), hvacAssembly) ?? []].sort(), ['electric', 'gas'], 'a central system stored as A/C alone pays both bills')
assert.equal(billsPaid(todayParts({ hvacType: 'package-unit' }), hvacAssembly), null, 'a package unit pays every bill')

const roiConfig = resolveRemodelRoiConfig()
const roiValues = createRemodelRoiDefaults(roiConfig)
roiValues.bills.electric.now = 380
roiValues.bills.gas.now = 90
roiValues.trades.hvac = { ducts: true, current: { ...createTradePicks().hvac.current, ageYears: 15 } }
const roiCuts = projectRemodelRoi(roiValues, roiConfig).cuts
const sceneFull = scene(centralBothProperty, { scopes: [split, ductsScope], view: 'proposed' }).savings.cuts
near(roiCuts.electric.combined, sceneFull.electric.combined, 'the calculator\'s HVAC with ducts cuts electric as the scene\'s full system does')
near(roiCuts.gas.combined, sceneFull.gas.combined, 'and gas')

assert.ok(TRADE_OUTCOMES.hvac.includes('off the electric bill'), 'the HVAC outcome puts the cut on the electric bill')
assert.ok(!TRADE_OUTCOMES.hvac.includes('off cooling'), 'and no longer says it comes off cooling')
const painPointsSource = readFileSync(new URL('../src/pain-points.ts', import.meta.url), 'utf8')
const hvacStatement = painPointsSource.match(/outcomeStatement:\s*`(A new high-efficiency system[^`]*(?:\$\{[^}]*\}[^`]*)*)`/)?.[1] ?? ''
assert.ok(hvacStatement.length > 0, 'the HVAC pain point has a high-efficiency outcome statement')
assert.ok(!/\d+\s*%/.test(hvacStatement.replace(/\$\{formatRowClaim\(tradeCutPercent\([^)]*\)\)\}/g, '').replace(/\$\{tradeCutPercent\([^)]*\)\}/g, '')), 'the HVAC pain point types no percent of its own')

// What heating & cooling draws and runs follows the resolved parts of the side on show
function drawn(property: Partial<PropertyProfile>, options: SceneOptions = {}) {
  const targets = scene(property, options)
  const materials = { ...HOME_MATERIAL_FACTS_UNSET, ...options.materials }
  return drawnHvac(hvacPartsOf(targets), { ...HOME_SCENE_DEFAULTS.property, ...property }, materials, options.view ?? 'existing', sceneRoofForm(targets), options.scopes ?? [])
}
const build = (scopes: string[], materials: Partial<HomeMaterialFacts> = {}): SceneOptions => ({ scopes, view: 'proposed', materials })
const both = { cools: true, heats: true }
const heatsOnly = { cools: false, heats: true }
const coolsOnly = { cools: true, heats: false }
const flat: Partial<PropertyProfile> = { roofType: 'flat' }
const wallFurnace: Partial<PropertyProfile> = { hvacType: 'wall-mounted', hvacComponents: 'furnace' }
const wallUnitHome: Partial<PropertyProfile> = { hvacType: 'wall-mounted', hvacComponents: 'both' }

const unknownToday = drawn({})
assert.equal(unknownToday.indoor?.location, 'attic', 'an unknown system stands its indoor unit in the attic')
assert.ok(unknownToday.indoor !== null, 'an unknown system has an indoor unit')
assert.ok(unknownToday.indoor.blower.material !== null && unknownToday.indoor.furnace !== null && unknownToday.indoor.coil !== null, 'an unknown system has a blower, furnace and coil')
assert.equal(unknownToday.outdoor?.kind, 'condenser', 'an unknown system has a condenser')
assert.ok(unknownToday.lineSet && unknownToday.registers, 'an unknown system has its line set and registers')
assert.deepEqual(unknownToday.duties, both, 'an unknown system heats and cools')

const furnaceToday = drawn(centralFurnaceProperty)
assert.equal(furnaceToday.indoor?.coil, null, 'a furnace alone draws no coil')
assert.equal(furnaceToday.outdoor, null, 'a furnace alone draws no condenser')
assert.equal(furnaceToday.lineSet, false, 'a furnace alone draws no line set')
assert.deepEqual(furnaceToday.duties, heatsOnly, 'a furnace alone only heats')
const furnaceSplit = drawn(centralFurnaceProperty, build([split]))
assert.ok((furnaceSplit.indoor?.coil ?? null) !== null && furnaceSplit.outdoor?.kind === 'condenser', 'a whole system on a furnace-only home draws the coil and condenser it adds')
assert.equal(furnaceSplit.lineSet, true, 'and the line set between them')
assert.deepEqual(furnaceSplit.duties, both, 'and the home then heats and cools')

const acToday = drawn(centralAcProperty)
assert.ok((acToday.indoor?.furnace ?? null) !== null, 'a central system stored as A/C alone draws its furnace')
assert.deepEqual(acToday.duties, both, 'and heats as well as cools')

const wallToday = drawn(wallFurnace)
assert.deepEqual(wallToday.wallUnit, { kind: 'wall-furnace', idle: false }, 'a wall furnace runs')
assert.equal(wallToday.indoor, null, 'a wall furnace home has no indoor unit')
assert.deepEqual(wallToday.duties, heatsOnly, 'a wall furnace only heats')
const wallNewCut = drawn(wallFurnace, build([SCOPE_IDS.splitSystemNewCut]))
assert.deepEqual(wallNewCut.wallUnit, { kind: 'wall-furnace', idle: true }, 'a new system leaves the wall furnace idle')
assert.equal(wallNewCut.indoor?.location, 'attic', 'a new system stands in the attic under a pitched roof')
assert.deepEqual(wallNewCut.duties, both, 'and the new system heats and cools')
assert.equal(drawn({ ...wallFurnace, ...flat }, build([SCOPE_IDS.splitSystemNewCut])).indoor?.location, 'closet', 'a new system under a flat roof stands in a closet')
assert.deepEqual(drawn({ hvacType: 'wall-mounted', hvacComponents: 'both' }).wallUnit, { kind: 'wall-unit', idle: false }, 'a wall unit that heats and cools is a wall unit')

assert.deepEqual(drawn({ hvacType: 'portable' }).windowUnit, { idle: false }, 'a portable home draws its window unit')

const miniToday = drawn({ hvacType: 'mini-split' }, { materials: { miniSplitHeads: '3' } })
assert.equal(miniToday.miniSplit?.heads, 3, 'a mini-split home draws its own head count')
assert.equal(miniToday.miniSplit?.idle, false, 'and its heads run')
assert.deepEqual(miniToday.duties, both, 'mini-splits heat and cool')
assert.equal(drawn({ hvacType: 'mini-split' }).miniSplit?.heads, 1, 'an unset head count is one head')

const miniAdded = drawn(centralBothProperty, build([SCOPE_IDS.miniSplitInstallation], { proposedMiniSplitHeads: '2' }))
assert.ok(miniAdded.indoor !== null, 'mini-splits added to a central home keep its indoor unit')
assert.equal(miniAdded.miniSplit?.heads, 2, 'the build draws its own head count')
assert.equal(miniAdded.miniSplit?.idle, false, 'and the added heads run')
assert.equal(drawn(centralBothProperty).miniSplit, null, 'a central home draws no mini-splits of its own')

const packageToday = drawn({ hvacType: 'package-unit' })
assert.ok(packageToday.packageUnit !== null, 'a package unit is drawn')
assert.equal(packageToday.indoor, null, 'a package unit has no indoor unit')
assert.deepEqual(packageToday.duties, both, 'a package unit heats and cools')

assert.equal(drawn(flat, { materials: { hvacIndoorLocation: 'attic' } }).indoor?.location, 'closet', 'a flat roof\'s joist space holds no indoor unit')
assert.equal(drawn(flat).indoor?.location, 'closet', 'a flat roof guesses a closet')
assert.equal(drawn({}, { materials: { hvacIndoorLocation: 'garage' } }).indoor?.location, 'closet', 'a location with no placement draws in the closet')
const closetHome = { hvacIndoorLocation: 'closet', proposedHvacIndoorLocation: 'attic' } as const
const moved = drawn({}, build([split], closetHome))
assert.equal(moved.indoor?.location, 'attic', 'a whole system moved to the attic stands there in the build')
assert.equal(moved.vacated, 'closet', 'and leaves its closet empty')
const movedToday = drawn({}, { scopes: [split], materials: closetHome })
assert.equal(movedToday.indoor?.location, 'closet', 'Today keeps the unit where it stands')
assert.equal(movedToday.vacated, null, 'and vacates nothing')
const notMoved = drawn({}, build([], closetHome))
assert.equal(notMoved.indoor?.location, 'closet', 'without a whole system the unit stays where it stands')
assert.equal(notMoved.vacated, null, 'and vacates nothing')
const flatMoved = drawn(flat, build([split], { proposedHvacIndoorLocation: 'attic' }))
assert.equal(flatMoved.indoor?.location, 'closet', 'a flat roof\'s whole system never moves into the joist space')
assert.equal(flatMoved.vacated, null, 'and vacates nothing')
assert.equal(atticHoldsUnit('pitched'), true, 'a pitched roof\'s attic holds an indoor unit')
assert.equal(atticHoldsUnit('low-slope'), false, 'a flat roof\'s does not')

for (const hvacType of ['wall-mounted', 'portable', 'mini-split'] as const) {
  assert.equal(drawn({ hvacType }).ducts, null, `${hvacType}: no ducts drawn`)
}
assert.ok(drawn({ hvacType: 'wall-mounted' }, build([SCOPE_IDS.splitSystemNewCut])).ducts !== null, 'a new system draws its ducts')
assert.ok(drawn({}).ducts !== null, 'a central home draws its ducts')

// The indoor side each pair of today's type and components carries, as [summer, winter]. A central system stored as A/C
// alone has its furnace, so it heats too; a wall or window unit stored as A/C only cools
const sidesBefore: [HVACType | null, HVACComponent | null, 'cooling' | null, 'heating' | null][] = [
  [null, null, 'cooling', 'heating'],
  [null, 'furnace', null, 'heating'],
  [null, 'ac', 'cooling', 'heating'],
  [null, 'both', 'cooling', 'heating'],
  ['central', null, 'cooling', 'heating'],
  ['central', 'furnace', null, 'heating'],
  ['central', 'ac', 'cooling', 'heating'],
  ['central', 'both', 'cooling', 'heating'],
  ['wall-mounted', null, 'cooling', 'heating'],
  ['wall-mounted', 'furnace', null, 'heating'],
  ['wall-mounted', 'ac', 'cooling', null],
  ['wall-mounted', 'both', 'cooling', 'heating'],
  ['portable', null, 'cooling', 'heating'],
  ['portable', 'furnace', null, 'heating'],
  ['portable', 'ac', 'cooling', null],
  ['portable', 'both', 'cooling', 'heating'],
  ['package-unit', null, 'cooling', 'heating'],
  ['package-unit', 'furnace', 'cooling', 'heating'],
  ['package-unit', 'ac', 'cooling', 'heating'],
  ['package-unit', 'both', 'cooling', 'heating'],
]
for (const [hvacType, hvacComponents, summer, winter] of sidesBefore) {
  const { duties } = drawn({ hvacType, hvacComponents })
  const pair = `${hvacType ?? 'unknown'} + ${hvacComponents ?? 'unset'}`
  assert.equal(indoorSide('summer', duties), summer, `${pair}: the summer side`)
  assert.equal(indoorSide('winter', duties), winter, `${pair}: the winter side`)
  assert.equal(indoorSide('normal', duties), null, `${pair}: a normal day runs nothing`)
  assert.equal(indoorSide('rain', duties), null, `${pair}: a storm runs nothing`)
}
for (const hvacComponents of [null, 'furnace', 'ac', 'both'] as const) {
  assert.deepEqual(drawn({ hvacType: 'mini-split', hvacComponents }).duties, both, `mini-split + ${hvacComponents ?? 'unset'}: mini-splits heat and cool whatever the components say`)
}

// The indoor unit lies flat in the attic or stands upright in an HVAC closet, its sections in the order the air passes
const along = (placement: IndoorUnitPlacement, point: Vec3) => point.reduce((sum, value, axis) => sum + value * placement.toward[axis]!, 0)
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
for (const location of ['attic', 'closet'] as const) {
  for (const form of ROOF_FORMS) {
    const placement = indoorUnitPlacement(location, form)
    assert.ok(placement !== null, `${location} under a ${form} roof has a placement`)
    const name = `${location}, ${form}`
    const whole = indoorUnitBoxes(placement, { furnace: true, coil: true })
    assert.deepEqual(whole.map(section => section.id), ['blower', 'furnace', 'coil', 'plenum'], `${name}: return, blower, furnace, coil, plenum`)
    assert.ok(Math.abs(along(placement, whole[0]!.box.position) - placement.lengths.blower / 2 - along(placement, placement.base)) < 1e-6, `${name}: the blower starts at the return`)
    whole.slice(1).forEach((section, index) => {
      const before = whole[index]!
      const farFace = along(placement, before.box.position) + placement.lengths[before.id] / 2
      const nearFace = along(placement, section.box.position) - placement.lengths[section.id] / 2
      assert.ok(Math.abs(farFace - nearFace) < 1e-6, `${name}: the ${before.id} meets the ${section.id}`)
    })
    const noFurnace = indoorUnitBoxes(placement, { furnace: false, coil: true })
    assert.deepEqual(noFurnace.map(section => section.id), ['blower', 'coil', 'plenum'], `${name}: a unit with no furnace, as a heat pump's, closes up`)
    const sectionAt = (sections: typeof whole, id: 'blower' | 'plenum') => along(placement, sections.find(section => section.id === id)!.box.position)
    if (placement.anchor === 'return') {
      assert.ok(Math.abs(sectionAt(whole, 'plenum') - sectionAt(noFurnace, 'plenum') - placement.lengths.furnace) < 1e-6, `${name}: and its plenum stands nearer the return by the furnace`)
    }
    else {
      assert.ok(Math.abs(sectionAt(noFurnace, 'blower') - sectionAt(whole, 'blower') - placement.lengths.furnace) < 1e-6 && Math.abs(sectionAt(noFurnace, 'plenum') - sectionAt(whole, 'plenum')) < 1e-6, `${name}: and its blower stands nearer the plenum by the furnace, the plenum where it was`)
    }
  }
}
assert.equal(indoorUnitPlacement('attic', 'pitched')!.anchor, 'plenum', 'the attic unit keeps its plenum where today\'s runs leave')
assert.equal(indoorUnitPlacement('closet', 'pitched')!.anchor, 'return', 'the closet unit stands on its floor')
const atticPlenum = indoorUnitBoxes(indoorUnitPlacement('attic', 'pitched')!, { furnace: true, coil: true }).find(section => section.id === 'plenum')!
assert.ok(distance(atticPlenum.box.position, EQUIPMENT.plenum.position) < 0.05, 'the attic unit\'s plenum stands where the runs leave')
assert.equal(INDOOR_UNIT_PLACEMENTS.garage, undefined, 'the garage has no placement yet')

const overlaps = (a: BoxSpec, b: BoxSpec) => a.size.every((size, axis) => Math.abs(a.position[axis]! - b.position[axis]!) < (size + b.size[axis]!) / 2 - 1e-9)
function furnitureBox({ position: [x, y, z], rotationY, standIn: { size: [width, height, depth] } }: (typeof HOME_FURNITURE)[number]): BoxSpec {
  const turned = Math.abs(Math.sin(rotationY)) > 0.5
  return { size: turned ? [depth, height, width] : [width, height, depth], position: [x, y + height / 2, z] }
}
const [thermostatX, thermostatY, thermostatWall] = EQUIPMENT.thermostat.position
const thermostatBox: BoxSpec = { size: THERMOSTAT_BOX.body, position: [thermostatX, thermostatY, thermostatWall + THERMOSTAT_BOX.body[2] / 2] }
const innerX = HOUSE.halfLength - HOUSE.wallThickness
for (const form of ROOF_FORMS) {
  const { closet } = indoorUnitPlacement('closet', form)!
  assert.ok(closet.length > 0, `${form}: the closet has walls`)
  for (const wall of closet) {
    const [width, , depth] = wall.size
    const [x, , z] = wall.position
    assert.ok(Math.abs(x) + width / 2 <= innerX + 1e-9 && z - depth / 2 >= BACK_INNER - 1e-9 && z + depth / 2 <= HOUSE.halfDepth, `${form}: a closet wall at x ${x.toFixed(2)} stands inside the house`)
  }
  // The whole space its walls and open door take, so nothing stands inside the closet either.
  const low = [0, 1, 2].map(axis => Math.min(...closet.map(wall => wall.position[axis]! - wall.size[axis]! / 2)))
  const high = [0, 1, 2].map(axis => Math.max(...closet.map(wall => wall.position[axis]! + wall.size[axis]! / 2)))
  const space: BoxSpec = { size: [high[0]! - low[0]!, high[1]! - low[1]!, high[2]! - low[2]!], position: [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2] }
  for (const piece of HOME_FURNITURE) {
    assert.ok(!overlaps(space, furnitureBox(piece)), `${form}: the closet stands clear of the ${piece.id}`)
  }
  for (const [kind, boxes] of Object.entries(FURNISHING_BOXES)) {
    assert.ok(boxes.every(box => !overlaps(space, box)), `${form}: the closet stands clear of the ${kind}`)
  }
  assert.ok(!overlaps(space, thermostatBox), `${form}: the closet stands clear of the thermostat`)
  const againstOutside = [Math.abs(low[0]! + innerX), Math.abs(high[0]! - innerX), Math.abs(low[2]! - BACK_INNER)].some(gap => gap < 1e-6)
  assert.ok(againstOutside, `${form}: the closet stands against an outside wall`)
}
// The closet and its unit stand clear of every heat arrow the house draws, open or Complete, in either season: an arrow is
// drawn about its lane, half its length either way
const arrowReach = HEAT_ARROW_LOOK.size.home / 2
const pointToBox = (point: Vec3, { size, position }: BoxSpec) => Math.hypot(...point.map((value, axis) => Math.max(0, Math.abs(value - position[axis]!) - size[axis]! / 2)))
function everyHeatLane(form: RoofForm) {
  const lanes = (['summer', 'winter'] as const).flatMap((season) => {
    const heat = scene({ roofType: form === 'pitched' ? 'shingle' : 'flat' }, { weather: season }).heat
    assert.ok(heat !== null, `${form} ${season}: the home has heat to draw`)
    return (['partly-open', 'complete'] as const).flatMap(view => homeHeatLanes(form, { ...heat, atticFanRunning: true }, season, view, null, ceilingOpenings(true)))
  })
  assert.ok(lanes.length > 0, `${form}: the house draws heat lanes`)
  return lanes
}
function nearestLane(lanes: ReturnType<typeof everyHeatLane>, boxes: readonly BoxSpec[]): number {
  let nearest = Infinity
  for (const { points } of lanes) {
    points.slice(1).forEach((to, index) => {
      const from = points[index]!
      const steps = Math.max(1, Math.ceil(distance(from, to) / 0.02))
      for (let step = 0; step <= steps; step++) {
        const point: Vec3 = [from[0] + (to[0] - from[0]) * step / steps, from[1] + (to[1] - from[1]) * step / steps, from[2] + (to[2] - from[2]) * step / steps]
        nearest = Math.min(nearest, ...boxes.map(box => pointToBox(point, box)))
      }
    })
  }
  return nearest
}
for (const form of ROOF_FORMS) {
  const placement = indoorUnitPlacement('closet', form)!
  const boxes = [...placement.closet, ...indoorUnitBoxes(placement, { furnace: true, coil: true }).map(section => section.box)]
  const nearest = nearestLane(everyHeatLane(form), boxes)
  assert.ok(nearest >= arrowReach, `${form}: the closet stands ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
}
const lowSlopeStarts = ductRunPoints('low-slope', EQUIPMENT.ductRadius, 0).map(run => run[0]!)
const [flatTrunkX, flatTrunkY, flatTrunkZ] = indoorUnitPlacement('closet', 'low-slope')!.trunk.at(-1)!
assert.ok(Math.hypot(flatTrunkX - EQUIPMENT.plenum.position[0], flatTrunkZ - EQUIPMENT.plenum.position[2]) < 0.05 && lowSlopeStarts.every(([, y]) => Math.abs(flatTrunkY - y) < 0.05), 'a flat roof\'s closet trunk ends where today\'s low-slope runs start')
assert.ok(distance(indoorUnitPlacement('closet', 'pitched')!.trunk.at(-1)!, EQUIPMENT.plenum.position) < 0.05, 'a pitched roof\'s closet trunk ends where the attic runs leave')
// The line set leaves the coil and meets the condenser's own lines where they come into the wall, on either floor
const condenserEntry: Vec3 = [-HOUSE.halfLength - CONDENSER_LINE_SET.size / 2, CONDENSER_LINE_SET.y, EQUIPMENT.condenser.position[2] + CONDENSER_LINE_SET.z]
for (const location of ['attic', 'closet'] as const) {
  for (const has of [{ furnace: true, coil: true }, { furnace: false, coil: true }]) {
    for (const floor of ['slab', 'raised'] as const) {
      const placement = indoorUnitPlacement(location, 'pitched')!
      const sections = indoorUnitBoxes(placement, has)
      const lines = indoorUnitLineSet(placement, sections, HOME_FLOOR_Y[floor])!
      const name = `${location}${has.furnace ? '' : ' with no furnace'} on a ${floor} floor`
      const coil = sections.find(section => section.id === 'coil')!.box
      assert.ok(lines[0]!.every((value, axis) => Math.abs(value - coil.position[axis]!) <= coil.size[axis]! / 2 + 1e-9), `${name}: the line set leaves the coil`)
      const [x, y, z] = lines.at(-1)!
      assert.ok(distance([x, y + HOME_FLOOR_Y[floor] - HOUSE.floorY, z], condenserEntry) < 1e-6, `${name}: the line set meets the condenser's lines`)
      assert.ok(lines.slice(1).every((point, index) => distance(point, lines[index]!) > 1e-3), `${name}: no two line set points coincide`)
    }
  }
}
assert.equal(indoorUnitLineSet(indoorUnitPlacement('attic', 'pitched')!, indoorUnitBoxes(indoorUnitPlacement('attic', 'pitched')!, { furnace: true, coil: false }), HOME_FLOOR_Y.slab), null, 'a furnace alone has no line set')
for (const location of hvacIndoorLocations) {
  const placed = INDOOR_UNIT_PLACEMENTS[location] !== undefined
  assert.equal(indoorLocation({ ...HOME_MATERIAL_FACTS_UNSET, hvacIndoorLocation: location }, 'pitched', 'existing', [], true), placed ? location : 'closet', `${location}: drawn where it has a placement, else in the closet`)
}

// The rep sets today's system and where its indoor unit stands; a build can move the unit to the attic and set its
// mini-split heads; a part the build adds where the home had none reads Added
const base = HOME_SCENE_DEFAULTS.property
for (const from of HVAC_SYSTEM_CHOICES) {
  const start = { ...base, ...hvacSystemPatch(from, base) }
  for (const choice of HVAC_SYSTEM_CHOICES) {
    assert.equal(hvacSystemChoice({ ...start, ...hvacSystemPatch(choice, start) }), choice, `${from} to ${choice}: the patch reads back as the choice`)
  }
}
assert.equal(hvacSystemChoice({ ...base, hvacType: null }), null, 'an unknown system reads as no choice')
assert.equal(hvacSystemChoice({ ...base, hvacType: 'wall-mounted', hvacComponents: 'ac' }), 'wall-unit', 'a wall unit that only cools is a wall unit')
assert.deepEqual(hvacSystemPatch('wall-furnace', base), { hvacType: 'wall-mounted', hvacComponents: 'furnace' })
assert.deepEqual(hvacSystemPatch('wall-unit', base), { hvacType: 'wall-mounted', hvacComponents: 'both' })
assert.deepEqual(hvacSystemPatch('portable', base), { hvacType: 'portable', hvacComponents: null })
assert.deepEqual(hvacSystemPatch('mini-split', base), { hvacType: 'mini-split', hvacComponents: null })
const furnaceUnknown: PropertyProfile = { ...base, hvacType: null, hvacComponents: 'furnace' }
assert.equal({ ...furnaceUnknown, ...hvacSystemPatch('central', furnaceUnknown) }.hvacComponents, 'furnace', 'a furnace-only home set to central stays furnace only')
assert.deepEqual(HVAC_SYSTEM_CHOICES.map(choice => HVAC_SYSTEM_CHOICE_LABELS[choice]), ['Central', 'Package unit', 'Wall furnace', 'Wall unit', 'Window / portable', 'Mini-splits'])
assert.deepEqual(hvacIndoorLocations.map(location => HVAC_INDOOR_LOCATION_LABELS[location]), ['Attic', 'HVAC closet', 'Garage'])
assert.deepEqual(miniSplitHeadCounts.map(count => MINI_SPLIT_HEAD_COUNT_LABELS[count]), ['1 head', '2 heads', '3 heads'])

const wallFurnaceProperty: PropertyProfile = { ...base, ...wallFurnace }
const wornWallFurnace = resolveHomeMaterials({ property: wallFurnaceProperty, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'heating-cooling': 'worn' } }, year: 2026 })
assert.equal(repairsRows(wallFurnaceProperty, wornWallFurnace).find(row => row.material === 'heating-cooling')?.note, 'Wall furnace · Worn', 'Repairs names a wall furnace as the Today chip does')

const slotsFor = (state: TradeSceneInputs) => sceneChangeSlots(state, resolveScene(resolveInputsOf(selectResolveInputs(state)), resolveTradeBillCuts(), 2026), 2026)
const slotIn = (state: TradeSceneInputs, id: SceneChangeSlotId) => slotsFor(state).find(slot => slot.id === id)
const valuesOf = (slot: SceneChangeSlot | undefined) => slot?.options.map(option => option.value)
const pitchedCentral = { hvacType: 'central', roofType: 'shingle' } as const
const flatCentral = { hvacType: 'central', roofType: 'flat' } as const
const systemSlot = slotIn(inputs(wallFurnace), 'heating-cooling')!
assert.deepEqual(valuesOf(systemSlot), [...HVAC_SYSTEM_CHOICES], 'today\'s system offers every system choice')
assert.equal(systemSlot.current, 'wall-furnace', 'a wall-mounted furnace reads as a wall furnace')
assert.deepEqual(systemSlot.change('wall-unit'), { kind: 'property', patch: { hvacType: 'wall-mounted', hvacComponents: 'both' } })
const locationSlot = slotIn(inputs(pitchedCentral), 'hvac-location')
assert.equal(locationSlot?.name, 'Indoor unit location')
assert.deepEqual(valuesOf(locationSlot), ['attic', 'closet'], 'a pitched roof\'s unit stands in the attic or a closet')
assert.equal(locationSlot?.current, 'attic', 'a pitched roof\'s unit is first guessed in the attic')
assert.deepEqual(locationSlot?.change('closet'), { kind: 'fact', patch: { hvacIndoorLocation: 'closet' } })
assert.deepEqual(valuesOf(slotIn(inputs(flatCentral), 'hvac-location')), ['closet'], 'a flat roof holds no unit in its joist space')
assert.equal(slotIn(inputs(flatCentral), 'hvac-location')?.current, 'closet')
assert.ok(slotIn(inputs({}), 'hvac-location') !== undefined, 'an unknown system is central, so its unit has a location')
assert.equal(slotIn(inputs(wallFurnace), 'hvac-location'), undefined, 'a wall home has no indoor unit to place')
assert.equal(slotIn(inputs(pitchedCentral), 'mini-split-heads'), undefined, 'a central home has no mini-split heads to count')
const headsSlot = slotIn(inputs({ hvacType: 'mini-split' }), 'mini-split-heads')
assert.equal(headsSlot?.name, 'Mini-split heads')
assert.deepEqual(valuesOf(headsSlot), ['1', '2', '3'])
assert.deepEqual(headsSlot?.change('2'), { kind: 'fact', patch: { miniSplitHeads: '2' } })

const closetMaterials = { ...HOME_MATERIAL_FACTS_UNSET, hvacIndoorLocation: 'closet' } as const
assert.equal(moveToAtticOffered(closetMaterials, 'pitched'), true, 'a pitched closet home can move its unit to the attic')
assert.equal(moveToAtticOffered({ ...HOME_MATERIAL_FACTS_UNSET, hvacIndoorLocation: 'attic' }, 'pitched'), false, 'a unit already in the attic has nowhere to move')
assert.equal(moveToAtticOffered(HOME_MATERIAL_FACTS_UNSET, 'pitched'), false, 'a pitched home\'s unit is first guessed in the attic')
assert.equal(moveToAtticOffered(closetMaterials, 'low-slope'), false, 'a flat roof holds no unit')
const closetHomeState = (property: Partial<PropertyProfile>, picks: string[]) => inputs(property, { homeMaterials: closetMaterials, proposedScopeIds: picks })
const moveSlot = (state: TradeSceneInputs) => slotIn(state, 'move:indoor-unit')!
const notPicked = moveSlot(closetHomeState(pitchedCentral, []))
assert.equal(notPicked.name, 'Move to the attic')
assert.ok(notPicked.unavailable !== null && notPicked.options.length === 0 && notPicked.current === null, 'with no whole system picked the move says why')
assert.ok(searchSceneChanges(slotsFor(closetHomeState(pitchedCentral, [])), 'move').some(result => result.slot.id === 'move:indoor-unit'), 'Modify finds the move')
const movable = moveSlot(closetHomeState(pitchedCentral, [split]))
assert.equal(movable.group, 'proposed')
assert.equal(movable.unavailable, null, 'a pitched closet home with a whole new system can move its unit')
assert.deepEqual(valuesOf(movable), ['on', 'off'])
assert.equal(movable.current, 'off')
assert.deepEqual(movable.change('on'), { kind: 'fact', patch: { proposedHvacIndoorLocation: 'attic' } }, 'switching it on moves the unit to the attic')
assert.deepEqual(movable.change('off'), { kind: 'fact', patch: { proposedHvacIndoorLocation: null } }, 'switching it off keeps the unit where it stands')
const movedOn = closetHomeState(pitchedCentral, [split])
const switchedOn = { ...movedOn, ...applySceneChange(movedOn, movable.change('on'), 2026) }
assert.equal(moveSlot(switchedOn).current, 'on')
assert.equal(moveSlot(closetHomeState(pitchedCentral, [SCOPE_IDS.acReplacement])).unavailable !== null, true, 'a half system keeps its unit where it stands')
assert.ok(moveSlot(closetHomeState(flatCentral, [split, SCOPE_IDS.roofRedeck])).unavailable !== null, 'a flat roof is never offered the move, even with a redeck')
assert.ok(moveSlot(inputs(pitchedCentral, { proposedScopeIds: [split] })).unavailable !== null, 'a unit already in the attic is never offered the move')
for (const property of [{ hvacType: 'package-unit' }, wallFurnace, wallUnitHome, { hvacType: 'portable' }, { hvacType: 'mini-split' }] as const) {
  const name = property.hvacType === 'wall-mounted' ? `wall-mounted ${property.hvacComponents}` : property.hvacType
  assert.equal(slotIn(closetHomeState(property, []), 'move:indoor-unit'), undefined, `${name}: Modify never lists the move, which no build it can pick allows`)
}
for (const [name, property] of [['unknown', {}], ['central', pitchedCentral]] as const) {
  assert.ok(slotIn(closetHomeState(property, []), 'move:indoor-unit') !== undefined, `${name}: a central home lists the move`)
}

assert.equal(workDetailsKind(SCOPE_IDS.splitSystemReplacement), 'indoor-unit', 'a whole new system can move its unit')
assert.equal(DETAILS_SWITCH[workDetailsKind(SCOPE_IDS.splitSystemReplacement)!], 'move:indoor-unit', 'its details hold the move\'s switch')
assert.ok(!/^const DETAILS_SWITCH/m.test(readFileSync('src/features/trade-scenes/ui/components/controls/system-card-body.tsx', 'utf8')), 'the details\' switches are a constant, not a table in the card')
assert.equal(workDetailsKind(SCOPE_IDS.miniSplitKit), 'mini-split', 'a mini-split kit sets its heads')
assert.equal(workDetailsKind(SCOPE_IDS.miniSplitInstallation), 'mini-split', 'a mini-split installation sets its heads')
assert.equal(workDetailsKind(SCOPE_IDS.acReplacement), null, 'an A/C replacement has nothing to pick')

const addedIds = (rows: readonly { id: string, added?: true }[]) => rows.filter(row => row.added).map(row => row.id)
const furnaceSplitRows = systemPartRows('heating-cooling', scene(centralFurnaceProperty, build([split])))
for (const id of ['coil', 'refrigerant-lines', 'condenser']) {
  assert.equal(furnaceSplitRows.find(row => row.id === id)?.added, true, `a furnace-only home's new ${id} reads Added`)
}
assert.ok(!addedIds(furnaceSplitRows).includes('furnace'), 'a new furnace over the old one is not added')
assert.equal(systemPartRows('attic', scene({}, build([SCOPE_IDS.radiantBarrier]))).find(row => row.id === 'radiant-barrier')?.added, true, 'a radiant barrier on a home with none reads Added')
assert.equal(PART_COPY.added, 'Added')

// The roof form read off the resolved roof and the one read off the roof type agree for every roof
for (const roofType of [...roofTypes, null]) {
  const resolved = sceneRoofForm(scene({ roofType }))
  assert.equal(homeSpotContext(inputs({ roofType })).form, resolved, `${roofType ?? 'unknown'} roof: the spots read the form the house is drawn with`)
  assert.equal(homeRoofForm(roofFormOf(roofType)), resolved, `${roofType ?? 'unknown'} roof: so does the camera`)
}

// The head count the rep sees pressed is the count the scene draws, set or not
const shownHeads = (side: 'existing' | 'proposed', materials: Partial<HomeMaterialFacts>) => miniSplitHeadCount({ ...HOME_MATERIAL_FACTS_UNSET, ...materials }, side)
assert.equal(slotIn(inputs({ hvacType: 'mini-split' }), 'mini-split-heads')?.current, String(drawn({ hvacType: 'mini-split' }).miniSplit?.heads), 'with no count set, Today\'s heads read the count drawn')
assert.equal(shownHeads('proposed', {}), String(drawn(centralBothProperty, build([SCOPE_IDS.miniSplitInstallation])).miniSplit?.heads), 'with no count set, the build\'s heads read the count drawn')
assert.equal(shownHeads('proposed', { miniSplitHeads: '3' }), String(drawn({ hvacType: 'mini-split' }, build([SCOPE_IDS.miniSplitInstallation], { miniSplitHeads: '3' })).miniSplit?.heads), 'the build keeps the home\'s own count until the rep picks another')
assert.equal(shownHeads('proposed', { miniSplitHeads: '3', proposedMiniSplitHeads: '2' }), String(drawn({ hvacType: 'mini-split' }, build([SCOPE_IDS.miniSplitInstallation], { miniSplitHeads: '3', proposedMiniSplitHeads: '2' })).miniSplit?.heads), 'a picked count is the count drawn')

// A flat roof's central home stored with its unit in the attic stands it in the closet
const flatCentralAttic = { ...HOME_MATERIAL_FACTS_UNSET, hvacIndoorLocation: 'attic' } as const
assert.equal(indoorLocation(flatCentralAttic, 'low-slope', 'existing', [], true), 'closet', 'Today reads a flat roof\'s stored attic as the closet')
assert.equal(drawn(flatCentral, { materials: { hvacIndoorLocation: 'attic' } }).indoor?.location, 'closet', 'and draws its indoor unit there')

// Heating & cooling opens on the indoor unit, walks its parts in the sales order, and the roof spot offers it where the
// system's air is in the attic
const focusOf = (property: Partial<PropertyProfile>, options: SceneOptions = {}) => hvacFocusOf(drawn(property, options))
function unitCentre(location: 'attic' | 'closet', form: RoofForm): Vec3 {
  const boxes = indoorUnitBoxes(indoorUnitPlacement(location, form)!, { furnace: true, coil: true }).map(section => section.box)
  const [low, high] = [Math.min, Math.max].map(pick => [0, 1, 2].map(axis => pick(...boxes.map(({ position, size }) => position[axis]! + (pick === Math.min ? -1 : 1) * size[axis]! / 2))))
  return [0, 1, 2].map(axis => (low![axis]! + high![axis]!) / 2) as unknown as Vec3
}
const raised = (point: Vec3, lift: number): Vec3 => [point[0], point[1] + lift, point[2]]
const hvacTarget = (form: RoofForm, property: Partial<PropertyProfile>, options: SceneOptions = {}, lift = 0) => SYSTEM_CAMERA_VIEWS['heating-cooling'](form, 'landscape', lift, { focus: focusOf(property, options), scale: 1 }).target
const closetOptions = { materials: { hvacIndoorLocation: 'closet' } } as const
for (const lift of [0, homeLift('raised')]) {
  assert.ok(distance(hvacTarget('pitched', {}, {}, lift), raised(unitCentre('attic', 'pitched'), lift)) < 0.1, `lift ${lift}: an unknown system's view looks at its attic indoor unit`)
  assert.ok(distance(hvacTarget('pitched', pitchedCentral, closetOptions, lift), raised(unitCentre('closet', 'pitched'), lift)) < 0.1, `lift ${lift}: a closet home's view looks at its closet unit`)
  assert.ok(distance(hvacTarget('low-slope', flatCentral, {}, lift), raised(unitCentre('closet', 'low-slope'), lift)) < 0.1, `lift ${lift}: a flat roof's central home looks at its closet unit`)
  assert.deepEqual(hvacTarget('pitched', { hvacType: 'package-unit' }, {}, lift), raised(packageUnitPlacement(false, 1).position, lift), `lift ${lift}: a package unit is looked at where it stands on the roof`)
  const [wallX, wallY] = hvacTarget('pitched', wallUnitHome, {}, lift)
  assert.ok(Math.abs(wallX - EQUIPMENT.wallUnit.x) < 1e-9 && Math.abs(wallY - EQUIPMENT.wallUnit.y - lift) < 1e-9, `lift ${lift}: a wall unit home is looked at its wall unit`)
  assert.ok(distance(hvacTarget('pitched', wallFurnace, {}, lift), raised(EQUIPMENT.wallFurnace.position, lift)) < 1e-9, `lift ${lift}: a wall furnace home is looked at its wall furnace`)
}
assert.deepEqual(focusOf({}), { kind: 'indoor', location: 'attic' })
assert.deepEqual(focusOf(wallFurnace, build([SCOPE_IDS.splitSystemNewCut])), { kind: 'indoor', location: 'attic' }, 'a new system\'s build looks at its new indoor unit')
assert.deepEqual(focusOf(wallFurnace), { kind: 'wall-furnace' })
assert.deepEqual(focusOf(wallUnitHome), { kind: 'wall-unit' })
assert.deepEqual(focusOf({ hvacType: 'portable' }), { kind: 'window-unit' })
assert.deepEqual(focusOf({ hvacType: 'mini-split' }), { kind: 'mini-split-head' })
assert.deepEqual(focusOf({ hvacType: 'package-unit' }), { kind: 'package' })
assert.deepEqual(focusOf(centralBothProperty, build([SCOPE_IDS.miniSplitInstallation])), { kind: 'indoor', location: 'attic' }, 'heads added to a central home leave the view on its indoor unit')

// The condenser's pad framing as up close drew it for every central system before the indoor unit took the view.
const PAD_LOOK = {
  landscape: { position: [-7.350458708934556, 1.8716857135675684, 1.8744381811742148], target: [-7.25, 0, -2.1], fov: 34 },
  narrow: { position: [-7.350458708934556, 1.8716857135675684, 1.8744381811742148], target: [-7.25, 0, -2.1], fov: 34 },
  portrait: { position: [-7.3881307247850145, 2.5735678561554063, 3.3648524991145448], target: [-7.25, 0, -2.1], fov: 34 },
} as const
for (const form of ROOF_FORMS) {
  const property = form === 'pitched' ? {} : flatCentral
  for (const shape of ['landscape', 'narrow', 'portrait'] as const) {
    for (const lift of [0, homeLift('raised')]) {
      const hvac = { focus: focusOf(property), scale: 1 }
      assert.notDeepEqual(lookInsideView('heating-cooling', form, shape, lift, hvac), PAD_LOOK[shape], `${form} ${shape} lift ${lift}: up close on a central system no longer frames the condenser's pad`)
      for (const part of ['condenser', 'refrigerant-lines'] as const) {
        const look = partLookInsideView('heating-cooling', part, form, shape, lift, hvac)!
        assert.deepEqual(look, PAD_LOOK[shape], `${form} ${shape} lift ${lift}: the ${part} picked swings to the condenser's pad`)
      }
    }
  }
}

const spotAt = (form: RoofForm, hvacType: HVACType | null, picks: string[] = [], hvacComponents: HVACComponent | null = null) => ({ form, picks, hvacType, hvacComponents })
assert.deepEqual(systemsAtSpot('roof', spotAt('pitched', null)), ['roof', 'attic', 'heating-cooling'], 'a pitched home\'s ducted system is offered at the roof')
assert.deepEqual(systemsAtSpot('roof', spotAt('pitched', 'package-unit')), ['roof', 'attic', 'heating-cooling'], 'so is a package unit\'s, whose trunk is in the attic')
assert.deepEqual(systemsAtSpot('roof', spotAt('low-slope', null)), ['roof'], 'a flat roof never offers heating & cooling')
assert.deepEqual(systemsAtSpot('roof', spotAt('low-slope', null, [SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofRedeck])), ['roof', 'attic'], 'not even with its joists opened')
assert.deepEqual(systemsAtSpot('roof', spotAt('pitched', 'wall-mounted')), ['roof', 'attic'], 'a wall home has nothing in the attic')
assert.deepEqual(systemsAtSpot('roof', spotAt('pitched', 'wall-mounted', [SCOPE_IDS.splitSystemNewCut])), ['roof', 'attic', 'heating-cooling'], 'until a new system puts its plenum there')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', 'central', [], 'furnace')), [], 'a furnace alone has nothing outside')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', 'central', [split], 'furnace')), ['heating-cooling'], 'a whole system puts a condenser outside')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', null)), ['heating-cooling'], 'an unknown system has its condenser')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', 'mini-split')), ['heating-cooling'], 'mini-splits have their outdoor unit')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', 'portable', [SCOPE_IDS.miniSplitInstallation])), ['heating-cooling'], 'so do mini-splits a build adds')
assert.deepEqual(systemsAtSpot('equipment', spotAt('pitched', 'wall-mounted')), [], 'a wall unit has no outdoor unit of its own')
assert.equal(canLookInside('heating-cooling', spotAt('pitched', 'wall-mounted')), false, 'a wall home has nothing to look inside')
assert.equal(canLookInside('heating-cooling', spotAt('pitched', 'central', [], 'furnace')), true, 'a furnace alone is looked inside from the roof')
assert.equal(canLookInside('heating-cooling', spotAt('low-slope', 'central', [], 'furnace')), false, 'except under a flat roof, where nothing outside offers it')
assert.equal(canLookInside('heating-cooling', spotAt('low-slope', 'central')), true, 'a flat roof\'s A/C offers it at its condenser')
assert.deepEqual(homeSpotContext(inputs({ hvacType: 'central', hvacComponents: 'ac' })).hvacComponents, 'ac', 'the spots read the home\'s components')

assert.deepEqual([...emphasizedParts('coil')].sort(), ['coil', 'condenser', 'refrigerant-lines'], 'the coil lights the line set and the condenser with it')
assert.deepEqual([...emphasizedParts('plenum')], ['plenum'], 'any other part lights alone')
assert.equal(emphasizedParts(null).size, 0, 'no emphasis lights nothing on its own')
const rowsFor = (property: Partial<PropertyProfile>, options: SceneOptions = {}) => systemPartRows('heating-cooling', scene(property, options))
const coilLit = systemLit('heating-cooling', rowsFor({}), 'coil')
for (const [part, opacity] of [['coil', 1], ['refrigerant-lines', 1], ['condenser', 1], ['plenum', LOOK_INSIDE.dimmedOpacity], ['blower', LOOK_INSIDE.dimmedOpacity]] as const) {
  assert.equal(systemPartOpacity(systemPartTag(part), false, coilLit, LOOK_INSIDE.ghostOpacity), opacity, `with the coil picked, the ${part} reads at ${opacity}`)
}
assert.equal(systemPartOpacity(systemPartTag('coil'), false, systemLit('heating-cooling', rowsFor({}), 'condenser'), LOOK_INSIDE.ghostOpacity), LOOK_INSIDE.dimmedOpacity, 'the pairing runs one way: the condenser picked dims the coil')

const ductPieces: readonly string[] = PART_PIECES['duct-runs']
const walked = listedRows(rowsFor({}, build([split, ductsScope]))).map(row => row.id).filter(id => !ductPieces.includes(id))
assert.deepEqual(walked, ['return', 'blower', 'furnace', 'coil', 'plenum', 'duct-runs', 'registers', 'thermostat', 'refrigerant-lines', 'condenser'], 'the system is walked in the sales order')

const allIds = rowsFor({}).map(row => row.id)
for (const location of ['attic', 'closet'] as const) {
  for (const form of ROOF_FORMS) {
    const sections = indoorUnitBoxes(indoorUnitPlacement(location, form)!, { furnace: true, coil: true })
    for (const { id, box } of sections) {
      assert.deepEqual(systemPartFocus('heating-cooling', form, id, 0, allIds, [], location), box.position, `${location}, ${form}: the ${id}'s pin rests on its section`)
    }
    const noFurnace = indoorUnitBoxes(indoorUnitPlacement(location, form)!, { furnace: false, coil: true })
    const noFurnaceIds = allIds.filter(id => id !== 'furnace')
    assert.deepEqual(systemPartFocus('heating-cooling', form, 'coil', 0, noFurnaceIds, [], location), noFurnace.find(section => section.id === 'coil')!.box.position, `${location}, ${form}: with no furnace, as a heat pump's, the coil's pin follows the closed-up unit`)
  }
}
assert.deepEqual(systemPartFocus('heating-cooling', 'pitched', 'thermostat', 0, allIds, []), EQUIPMENT.thermostat.position, 'the thermostat\'s pin is on the thermostat')
const registerPin = systemPartFocus('heating-cooling', 'pitched', 'registers', 0, allIds, [])!
const livingGrille = ceilingOpenings(true).find(opening => opening.kind === 'boot' && opening.at[0] > ROOMS.living.from && opening.at[0] < ROOMS.living.to)!
assert.ok(registerPin[0] === livingGrille.at[0] && registerPin[2] === livingGrille.at[1] && registerPin[1] < WALL_TOP_Y - HOUSE.ceilingThickness, 'the registers\' pin is on the living room\'s grille, under the ceiling')

// Each component runs in its own season, and a wall or window unit a new system leaves stays off
const runningOf = (weather: Weather, property: Partial<PropertyProfile>, options: SceneOptions = {}) => [...hvacRunning(drawn(property, options), weather)].sort()
assert.deepEqual(runningOf('summer', {}), ['blower', 'coil', 'outdoor'], 'an unknown system cools with its blower, coil and condenser in summer')
assert.deepEqual(runningOf('winter', {}), ['blower', 'furnace'], 'and heats with its blower and furnace in winter')
assert.deepEqual(runningOf('normal', {}), [], 'a normal day runs nothing')
assert.deepEqual(runningOf('rain', {}), [], 'nor does a storm')
assert.deepEqual(runningOf('summer', centralFurnaceProperty), [], 'a furnace alone runs nothing in summer')
assert.deepEqual(runningOf('winter', centralFurnaceProperty), ['blower', 'furnace'], 'and heats in winter')
assert.deepEqual(runningOf('winter', centralAcProperty), ['blower', 'furnace'], 'a central system stored as A/C alone heats in winter')
assert.deepEqual(runningOf('summer', centralAcProperty), ['blower', 'coil', 'outdoor'], 'and cools in summer')
assert.deepEqual(runningOf('summer', centralFurnaceProperty, build([split])), ['blower', 'coil', 'outdoor'], 'a whole system on a furnace-only home cools with what it adds')
assert.deepEqual(runningOf('winter', wallFurnace), ['wall-unit'], 'a wall furnace heats in winter')
assert.deepEqual(runningOf('summer', wallFurnace), [], 'and never cools')
assert.deepEqual(runningOf('winter', wallFurnace, build([SCOPE_IDS.splitSystemNewCut])), ['blower', 'furnace'], 'a new system heats while the wall furnace it leaves stays off')
assert.deepEqual(runningOf('summer', wallFurnace, build([SCOPE_IDS.splitSystemNewCut])), ['blower', 'coil', 'outdoor'], 'and cools')
assert.deepEqual(runningOf('summer', wallUnitHome), ['wall-unit'], 'a wall unit cools in summer')
assert.deepEqual(runningOf('winter', wallUnitHome), ['wall-unit'], 'and heats in winter')
const wallAc: Partial<PropertyProfile> = { hvacType: 'wall-mounted', hvacComponents: 'ac' }
assert.deepEqual(runningOf('winter', wallAc), [], 'a wall unit that only cools runs nothing in winter')
assert.deepEqual(runningOf('winter', wallAc, build([SCOPE_IDS.miniSplitInstallation])), ['mini-split'], 'not even beside heads that heat')
assert.deepEqual(runningOf('summer', wallAc, build([SCOPE_IDS.miniSplitInstallation])), ['mini-split', 'wall-unit'], 'heads added beside a wall unit run with it')
assert.deepEqual(runningOf('summer', { hvacType: 'portable' }), ['window-unit'], 'a window unit cools in summer')
assert.deepEqual(runningOf('winter', { hvacType: 'portable', hvacComponents: 'ac' }), [], 'a window unit that only cools runs nothing in winter')
assert.deepEqual(runningOf('summer', { hvacType: 'portable' }, build([SCOPE_IDS.splitSystemNewCut])), ['blower', 'coil', 'outdoor'], 'a new system leaves the window unit off')
for (const weather of ['summer', 'winter'] as const) {
  assert.deepEqual(runningOf(weather, { hvacType: 'mini-split' }), ['mini-split'], `mini-splits run in ${weather}`)
  assert.deepEqual(runningOf(weather, { hvacType: 'package-unit' }), ['package'], `a package unit runs in ${weather}`)
}
assert.deepEqual(runningOf('normal', { hvacType: 'package-unit' }), [], 'a package unit rests on a normal day')

// The wall furnace stands low on a partition, inside the house and clear of the doorway, the closet, the furnishings and
// every heat arrow
const wallFurnaceBox: BoxSpec = { size: EQUIPMENT.wallFurnace.size, position: EQUIPMENT.wallFurnace.position }
{
  const [x, y, z] = wallFurnaceBox.position
  const [width, height, depth] = wallFurnaceBox.size
  assert.ok(Math.abs(x) + width / 2 <= innerX && z - depth / 2 >= BACK_INNER && z + depth / 2 <= HOUSE.halfDepth && y - height / 2 >= HOUSE.floorY, 'the wall furnace stands inside the house')
  const { partition, facing } = EQUIPMENT.wallFurnace
  const face = PARTITIONS_X[partition] + facing * HOUSE.partitionThickness / 2
  assert.ok(Math.abs(x - facing * width / 2 - face) < 1e-9, 'the wall furnace stands flush on its partition\'s face, on the side it faces, never through it')
  assert.ok(Math.abs(z - PARTITION_DOOR.along) >= (depth + PARTITION_DOOR.width) / 2, 'and clear of its doorway')
}
for (const piece of HOME_FURNITURE) {
  assert.ok(!overlaps(wallFurnaceBox, furnitureBox(piece)), `the wall furnace stands clear of the ${piece.id}`)
}
for (const [kind, boxes] of Object.entries(FURNISHING_BOXES)) {
  assert.ok(boxes.every(box => !overlaps(wallFurnaceBox, box)), `the wall furnace stands clear of the ${kind}`)
}
assert.ok(!overlaps(wallFurnaceBox, thermostatBox), 'the wall furnace stands clear of the thermostat')
for (const form of ROOF_FORMS) {
  const placement = indoorUnitPlacement('closet', form)!
  for (const box of [...placement.closet, ...indoorUnitBoxes(placement, { furnace: true, coil: true }).map(section => section.box)]) {
    assert.ok(!overlaps(wallFurnaceBox, box), `${form}: the wall furnace stands clear of the closet`)
  }
  const nearest = nearestLane(everyHeatLane(form), [wallFurnaceBox])
  assert.ok(nearest >= arrowReach, `${form}: the wall furnace stands ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
}

// Mini-split heads hang high on each room's outside wall, and one outdoor unit in the left side yard feeds each of them
// through its own run along the outside walls
assert.deepEqual(MINI_SPLIT_HEADS.map(head => head.room), ['living', 'bedroom', 'kitchen'], 'the heads fill the rooms living room, bedroom, kitchen')
const [headAlong, headHeight, headOut] = MINI_SPLIT_HEAD_SIZE
const headBox = ({ position: [x, y, z], outward }: (typeof MINI_SPLIT_HEADS)[number]): BoxSpec => ({ size: MINI_SPLIT_HEAD_SIZE, position: [x, y, z - outward * headOut / 2] })
const innerFace = (wall: HouseWall) => wall.line - wall.outward * HOUSE.wallThickness / 2
const wallUnitBox: BoxSpec = { size: EQUIPMENT.wallUnit.size, position: [EQUIPMENT.wallUnit.x, EQUIPMENT.wallUnit.y, -HOUSE.halfDepth - EQUIPMENT.wallUnit.outside + EQUIPMENT.wallUnit.size[2] / 2] }
const windowUnitBox: BoxSpec = {
  size: EQUIPMENT.windowUnit.size,
  position: [EQUIPMENT.windowUnit.x, HOUSE.floorY + HOUSE_WALLS.back.openings[0].sill + EQUIPMENT.windowUnit.size[1] / 2, HOUSE_WALLS.back.line + EQUIPMENT.windowUnit.inside - EQUIPMENT.windowUnit.size[2] / 2],
}
const lanesByForm = { 'pitched': everyHeatLane('pitched'), 'low-slope': everyHeatLane('low-slope') } as const satisfies Record<RoofForm, unknown>
const closetBoxes = ROOF_FORMS.flatMap((form) => {
  const placement = indoorUnitPlacement('closet', form)!
  return [...placement.closet, ...indoorUnitBoxes(placement, { furnace: true, coil: true }).map(section => section.box)]
})
for (const head of MINI_SPLIT_HEADS) {
  const [x, y, z] = head.position
  const name = `the ${head.room} head`
  const walls = Object.values(HOUSE_WALLS).filter((wall: HouseWall) => {
    const across = wall.run === 'x' ? z : x
    const along = wall.run === 'x' ? x : z
    return wall.outward === head.outward && Math.abs(across - innerFace(wall)) <= 0.05 && along >= wall.from && along <= wall.to
  })
  assert.equal(walls.length, 1, `${name} hangs on an outside wall's inside face`)
  const wall: HouseWall = walls[0]!
  assert.equal(wall.run, 'x', `${name} hangs on a wall running along x, the way its size is laid`)
  const room = ROOMS[head.room]
  assert.ok(x - headAlong / 2 >= room.from && x + headAlong / 2 <= room.to, `${name} stands inside its room`)
  assert.ok(y - headHeight / 2 > HOUSE.floorY + PARTITION_DOOR.head && y + headHeight / 2 < WALL_TOP_Y - HOUSE.ceilingThickness, `${name} hangs high, under the ceiling`)
  for (const opening of wall.openings) {
    const apart = Math.abs(x - opening.along) >= (headAlong + opening.width) / 2 + 0.1
    assert.ok(apart || y - headHeight / 2 >= HOUSE.floorY + opening.head + 0.05, `${name} stands clear of the window at ${opening.along}`)
  }
  const box = headBox(head)
  for (const [what, other] of [['wall unit', wallUnitBox], ['window unit', windowUnitBox], ['thermostat', thermostatBox], ['wall furnace', wallFurnaceBox]] as const) {
    assert.ok(!overlaps(box, other), `${name} stands clear of the ${what}`)
  }
  for (const piece of HOME_FURNITURE) {
    assert.ok(!overlaps(box, furnitureBox(piece)), `${name} stands clear of the ${piece.id}`)
  }
  for (const [kind, boxes] of Object.entries(FURNISHING_BOXES)) {
    assert.ok(boxes.every(other => !overlaps(box, other)), `${name} stands clear of the ${kind}`)
  }
  assert.ok(closetBoxes.every(other => !overlaps(box, other)), `${name} stands clear of the closet`)
  for (const form of ROOF_FORMS) {
    const nearest = nearestLane(lanesByForm[form], [box])
    assert.ok(nearest >= arrowReach, `${form}: ${name} stands ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
  }
}

const outdoorBox: BoxSpec = { size: MINI_SPLIT_OUTDOOR.size, position: MINI_SPLIT_OUTDOOR.position }
{
  const [x, y, z] = outdoorBox.position
  const [depth, height] = outdoorBox.size
  assert.ok(Math.abs(y - height / 2) < 1e-9, 'the outdoor unit stands on the ground')
  assert.ok(x + depth / 2 < -HOUSE.halfLength && x - depth / 2 > LOT.left, 'the outdoor unit stands in the left side yard')
  const house: BoxSpec = { size: [HOUSE.halfLength * 2, 4, HOUSE.halfDepth * 2], position: [0, 2, 0] }
  assert.ok(!overlaps(outdoorBox, house), 'the outdoor unit stands clear of the house')
  const [padX, , padZ] = EQUIPMENT.condenser.position
  const [padWidth, , padDepth] = EQUIPMENT.condenser.pad
  // The pad and the column the condenser stands in on it, at its largest size.
  const condenserColumn: BoxSpec = { size: [padWidth, 3, padDepth], position: [padX, 1.5, padZ] }
  assert.ok(!overlaps(outdoorBox, condenserColumn), 'the outdoor unit stands clear of the condenser\'s pad')
  assert.ok(Math.hypot(x - padX, z - padZ) < 2.5, 'near it')
  for (const form of ROOF_FORMS) {
    for (const foundation of ['slab', 'raised'] as const) {
      // The lanes ride with the house; the unit stands on the lawn, so in the house's frame it sits lower as the floor rises.
      const lifted: BoxSpec = { size: outdoorBox.size, position: [x, y - homeLift(foundation), z] }
      const nearest = nearestLane(lanesByForm[form], [lifted])
      assert.ok(nearest >= arrowReach, `${form} ${foundation}: the outdoor unit stands ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
    }
  }
}

assert.equal(miniSplitLineSet(2).length, 2, 'two heads, two runs')
const lineReach = MINI_SPLIT_LINE_SIZE / 2
const backOpenings = HOUSE_WALLS.back.openings
for (const floor of ['slab', 'raised'] as const) {
  const floorY = HOME_FLOOR_Y[floor]
  const runs = miniSplitLineSet(MINI_SPLIT_HEADS.length, floorY)
  assert.deepEqual(MINI_SPLIT_HEADS.map((_, index) => miniSplitLineSet(index + 1, floorY).length), [1, 2, 3], `${floor}: a run for each head`)
  runs.forEach((run, index) => {
    const head = MINI_SPLIT_HEADS[index]!
    const name = `${floor}: the ${head.room} head's run`
    const [startX, startY, startZ] = run[0]!
    const groundStart: Vec3 = [startX, startY + floorY - HOUSE.floorY, startZ]
    assert.ok(pointToBox(groundStart, outdoorBox) < 1e-9, `${name} leaves the outdoor unit`)
    assert.ok(pointToBox(run.at(-1)!, headBox(head)) < 1e-9, `${name} ends behind its head`)
    assert.ok(run.slice(1).every((point, at) => point.filter((value, axis) => Math.abs(value - run[at]![axis]!) > 1e-9).length === 1), `${name} runs straight along the walls, one axis at a time`)
    assert.ok(run.slice(0, -1).every(([px, , pz]) => Math.abs(px) >= HOUSE.halfLength || Math.abs(pz) >= HOUSE.halfDepth), `${name} keeps outside the house until it comes through the wall behind its head`)
    for (let at = 1; at < run.length; at++) {
      const [from, to] = [run[at - 1]!, run[at]!]
      if (from[1] !== to[1] || from[2] !== to[2] || Math.abs(from[2] + HOUSE.halfDepth) > lineReach + 1e-9) {
        continue
      }
      const [low, high] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])]
      for (const opening of backOpenings) {
        const crosses = high > opening.along - opening.width / 2 && low < opening.along + opening.width / 2
        assert.ok(!crosses || from[1] - lineReach >= HOUSE.floorY + opening.head + 0.05, `${name} passes over the back window at ${opening.along}`)
      }
    }
  })
  const lines = lineSetBoxes(runs, MINI_SPLIT_LINE_SIZE)
  for (const form of ROOF_FORMS) {
    const downspouts = downspoutBoxes(form)
    assert.ok(lines.every(line => downspouts.every(spout => !overlaps(line, spout))), `${form} ${floor}: the runs pass clear of the downspouts`)
    const nearest = nearestLane(lanesByForm[form], lines)
    assert.ok(nearest >= arrowReach, `${form} ${floor}: the runs pass ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
    const closetLines = indoorUnitPlacement('closet', form)!.lineSet
    assert.ok(lines.every(line => closetLines.every(point => pointToBox(point, line) > CONDENSER_LINE_SET.size)), `${form} ${floor}: the runs keep clear of the closet's line set`)
  }
  assert.ok(lines.every(line => !overlaps(line, wallUnitBox) && !overlaps(line, windowUnitBox)), `${floor}: the runs keep clear of the wall and window units`)
}

const miniIds = rowsFor({ hvacType: 'mini-split' }).map(row => row.id)
const firstHead = headBox(MINI_SPLIT_HEADS[0])
for (const form of ROOF_FORMS) {
  assert.deepEqual(systemPartFocus('heating-cooling', form, 'mini-split-heads', 0, miniIds, []), firstHead.position, `${form}: the heads' pin rests on the first head`)
  assert.deepEqual(systemPartFocus('heating-cooling', form, 'mini-split-outdoor', 0, miniIds, []), MINI_SPLIT_OUTDOOR.position, `${form}: the outdoor unit's pin rests on the unit`)
  const [headX, headY, headZ] = MINI_SPLIT_HEADS[0].position
  const [aimX, aimY, aimZ] = SYSTEM_CAMERA_VIEWS['heating-cooling'](form, 'landscape', 0, { focus: { kind: 'mini-split-head' }, scale: 1 }).target
  assert.ok(aimX === headX && aimZ === headZ && aimY < headY && aimY > HOUSE.floorY, `${form}: a mini-split home is looked at on its first head's wall, under the head`)
}

// A central system is a furnace alone or a furnace with A/C, never A/C alone: one stored as A/C resolves, offers, cuts and
// draws as a furnace with A/C, and Today's equipment choice offers only the two
assert.equal(centralComponents('ac'), 'both', 'a central system stored as A/C alone reads as a furnace with A/C')
assert.equal(centralComponents('furnace'), 'furnace')
assert.equal(centralComponents('both'), 'both')
assert.equal(centralComponents(null), null, 'an unset equipment stays unset')
for (const hvacType of ['central', null] as const) {
  const stored: Partial<PropertyProfile> = { hvacType, hvacComponents: 'ac' }
  const read: Partial<PropertyProfile> = { hvacType, hvacComponents: 'both' }
  const name = `${hvacType ?? 'unknown'} stored as A/C`
  assert.deepEqual(hvacPartsOf(scene(stored)), hvacPartsOf(scene(read)), `${name}: resolves as a furnace with A/C`)
  assert.deepEqual(offersOf(stored), offersOf(read), `${name}: is offered what a furnace with A/C is`)
  for (const scopes of [[split], [split, ductsScope], [ductsScope], [SCOPE_IDS.acReplacement], [SCOPE_IDS.furnaceReplacement]]) {
    const build = scopes.map(id => scopeName[id]).join(' + ')
    assert.deepEqual(scene(stored, { scopes, view: 'proposed' }).savings.cuts, scene(read, { scopes, view: 'proposed' }).savings.cuts, `${name}, ${build}: cuts as a furnace with A/C`)
    assert.deepEqual(drawn(stored, { scopes, view: 'proposed' }), drawn(read, { scopes, view: 'proposed' }), `${name}, ${build}: draws as a furnace with A/C`)
  }
  const equipment = slotIn(inputs(stored), 'hvac-components')
  assert.deepEqual(valuesOf(equipment), ['furnace', 'both'], `${name}: Today's equipment offers a furnace alone or a furnace with A/C`)
  assert.deepEqual(equipment?.options.map(option => option.label), [HVAC_COMPONENT_LABELS.furnace, HVAC_COMPONENT_LABELS.both], `${name}: under their own labels`)
  assert.equal(equipment?.current, 'both', `${name}: reads as a furnace with A/C`)
}
const wallAcHome: PropertyProfile = { ...base, hvacType: 'wall-mounted', hvacComponents: 'ac' }
assert.equal({ ...wallAcHome, ...hvacSystemPatch('central', wallAcHome) }.hvacComponents, 'both', 'a wall unit that only cools, set to central, becomes a furnace with A/C')
assert.deepEqual(drawn(wallAcHome).wallOrWindowDuties, coolsOnly, 'a wall unit stored as A/C still only cools')

// Room air comes up through a big return grille into the cabinet's return end: the return is a part of every central
// system, the first one walked, drawn on the room side of the ceiling for an attic unit and low on the closet at the blower
// for a closet unit
for (const hvacType of [null, 'central'] as const) {
  assert.equal(hvacPartsOf(scene({ hvacType })).find(part => part.id === 'return')?.material, 'return-grille', `${hvacType ?? 'unknown'}: a central system has its return`)
}
for (const hvacType of ['wall-mounted', 'portable', 'mini-split', 'package-unit'] as const) {
  assert.ok(!presentIds({ hvacType }).includes('return'), `${hvacType}: no return of its own`)
}
assert.equal(PART_COPY.added, 'Added')
assert.equal(systemPartRows('heating-cooling', scene(wallFurnace, build([SCOPE_IDS.splitSystemNewCut]))).find(row => row.id === 'return')?.added, true, 'a new system on a wall home reads its return Added')
assert.equal(listedRows(rowsFor({})).map(row => row.id)[0], 'return', 'the walk starts where the air comes in')
assert.deepEqual(ASSEMBLIES['hvac-attic'].parts.find(part => part.id === 'return')?.materials, { 'return-grille': { copy: { label: 'Return', detail: 'The big grille where the blower pulls the room air back into the system.' } } })

const ceilingUnderside = WALL_TOP_Y - HOUSE.ceilingThickness
const SUPPLY_PLATE = 0.4
const footprintApart = (a: BoxSpec, at: readonly [number, number], half: number) => Math.abs(a.position[0] - at[0]) >= a.size[0] / 2 + half || Math.abs(a.position[2] - at[1]) >= a.size[2] / 2 + half
for (const form of ROOF_FORMS) {
  const attic = indoorUnitPlacement('attic', form)!
  const { grille, facing } = attic.returnAir
  const duct = indoorUnitReturnDuct(attic, indoorUnitBoxes(attic, { furnace: true, coil: true }))
  const name = `attic, ${form}`
  assert.deepEqual(facing, [0, -1, 0], `${name}: the return grille faces down into the room`)
  assert.ok(Math.abs(grille.position[1] + grille.size[1] / 2 - ceilingUnderside) < 1e-9, `${name}: the return grille lies on the room side of the ceiling`)
  assert.ok(grille.size[0] > SUPPLY_PLATE && grille.size[2] > SUPPLY_PLATE, `${name}: the return grille is bigger than a supply register`)
  assert.ok(grille.position[2] + grille.size[2] / 2 <= ATTIC_SPANS.open.to, `${name}: the return grille stands behind the ceiling's cut`)
  assert.ok(Object.values(ROOMS).some(room => grille.position[0] - grille.size[0] / 2 >= room.from && grille.position[0] + grille.size[0] / 2 <= room.to), `${name}: the return grille is in one room`)
  for (const opening of ceilingOpenings(true)) {
    const half = opening.kind === 'boot' ? SUPPLY_PLATE / 2 : opening.radius + 0.05
    assert.ok(footprintApart(grille, opening.at, half), `${name}: the return grille stands clear of the ${opening.kind} at ${opening.at.join(', ')}`)
  }
  const blower = indoorUnitBoxes(attic, { furnace: true, coil: true })[0]!.box
  assert.ok(duct.length >= 2, `${name}: a return duct runs up from the grille`)
  const [startX, startY, startZ] = duct[0]!
  assert.ok(Math.abs(startX - grille.position[0]) <= grille.size[0] / 2 && Math.abs(startZ - grille.position[2]) <= grille.size[2] / 2 && Math.abs(startY - WALL_TOP_Y) < 1e-9, `${name}: the return duct leaves the grille's back through the ceiling`)
  assert.ok(pointToBox(duct.at(-1)!, blower) < 1e-9, `${name}: and ends on the blower at the cabinet's return end`)
  assert.ok(along(attic, duct.at(-1)!) - along(attic, attic.base) <= attic.lengths.blower / 2 + 1e-9, `${name}: in the return half of the blower`)

  const closet = indoorUnitPlacement('closet', form)!
  const closetName = `closet, ${form}`
  const closetBlower = indoorUnitBoxes(closet, { furnace: true, coil: true })[0]!.box
  const closetGrille = closet.returnAir.grille
  assert.equal(indoorUnitReturnDuct(closet, indoorUnitBoxes(closet, { furnace: true, coil: true })).length, 0, `${closetName}: the air comes in through the closet, with no return duct`)
  const [low, high] = [closetBlower.position[1] - closetBlower.size[1] / 2, closetBlower.position[1] + closetBlower.size[1] / 2]
  assert.ok(closetGrille.position[1] - closetGrille.size[1] / 2 >= low && closetGrille.position[1] + closetGrille.size[1] / 2 <= high, `${closetName}: the return grille is at the blower's height`)
  assert.ok(closetGrille.position[1] + closetGrille.size[1] / 2 < ceilingUnderside - 1, `${closetName}: low on the closet, never on the ceiling`)
  const facingAxis = closet.returnAir.facing.findIndex(value => value !== 0)
  const backFace = closetGrille.position[facingAxis]! - closet.returnAir.facing[facingAxis]! * closetGrille.size[facingAxis]! / 2
  assert.ok(closet.closet.some(wall => Math.abs(wall.position[facingAxis]! + closet.returnAir.facing[facingAxis]! * wall.size[facingAxis]! / 2 - backFace) < 1e-9 && [0, 1, 2].every(axis => axis === facingAxis || Math.abs(closetGrille.position[axis]! - wall.position[axis]!) + closetGrille.size[axis]! / 2 <= wall.size[axis]! / 2 + 1e-9)), `${closetName}: the return grille sits on a closet wall's outside face`)

  for (const location of ['attic', 'closet'] as const) {
    const placement = indoorUnitPlacement(location, form)!
    const { grille } = placement.returnAir
    const duct = indoorUnitReturnDuct(placement, indoorUnitBoxes(placement, { furnace: true, coil: true }))
    const ductBoxes = duct.map((point): BoxSpec => ({ size: [0, 0, 0], position: point }))
    const nearest = nearestLane(lanesByForm[form], [grille, ...ductBoxes]) - (duct.length > 0 ? INDOOR_UNIT_LOOK.returnRadius : 0)
    assert.ok(nearest >= arrowReach, `${location}, ${form}: the return stands ${nearest.toFixed(3)} m from the nearest heat lane, inside an arrow's ${arrowReach} m reach`)
    assert.deepEqual(systemPartFocus('heating-cooling', form, 'return', 0, allIds, [], location), indoorUnitPlacement(location, form)!.returnAir.grille.position, `${location}, ${form}: the return's pin rests on its grille`)
  }
}

// An attic unit short a section keeps its plenum where the runs leave and closes up toward the return, its return duct
// following the blower
const sectionSets = [{ furnace: true, coil: true }, { furnace: true, coil: false }, { furnace: false, coil: true }, { furnace: false, coil: false }] as const
for (const form of ROOF_FORMS) {
  const attic = indoorUnitPlacement('attic', form)!
  for (const has of sectionSets) {
    const name = `attic, ${form}, ${has.furnace ? 'furnace' : 'no furnace'} and ${has.coil ? 'coil' : 'no coil'}`
    const sections = indoorUnitBoxes(attic, has)
    const plenum = sections.find(section => section.id === 'plenum')!.box
    assert.ok(distance(plenum.position, EQUIPMENT.plenum.position) < 1e-6, `${name}: the plenum stands where the runs leave, whatever section is missing`)
    assert.equal(indoorUnitTrunk(attic, sections), null, `${name}: so no trunk or junction box is drawn`)
    const duct = indoorUnitReturnDuct(attic, sections)
    const blower = sections.find(section => section.id === 'blower')!.box
    assert.deepEqual(duct.slice(0, attic.returnAir.duct.length), [...attic.returnAir.duct], `${name}: the return duct still leaves the grille where it did`)
    assert.ok(pointToBox(duct.at(-1)!, blower) < 1e-9 && along(attic, duct.at(-1)!) - along(attic, blower.position) <= 1e-9, `${name}: and ends on the moved blower, in its return half`)
    assert.ok(nearestLane(lanesByForm[form], duct.map((point): BoxSpec => ({ size: [0, 0, 0], position: point }))) - INDOOR_UNIT_LOOK.returnRadius >= arrowReach, `${name}: the moved return duct stands clear of every heat arrow`)
  }
}

// The closet takes the paint of the room it stands in
assert.equal(roomAt(-4), ROOMS.bedroom)
assert.equal(roomAt(0), ROOMS.living)
assert.equal(roomAt(4), ROOMS.kitchen)
assert.equal(roomAt(-HOUSE.halfLength), ROOMS.bedroom, 'inside the left end wall is the bedroom')
assert.equal(roomAt(HOUSE.halfLength), ROOMS.kitchen, 'inside the right end wall is the kitchen')

// A heat pump replaces a central system or installs new where there is none: a blower and coil with no furnace, and one
// outdoor unit that heats and cools. A replacement takes the furnace out, and its heating earns no cut on either bill
const heatPump = SCOPE_IDS.heatPumpReplacement
const heatPumpNew = SCOPE_IDS.heatPumpNewCut
const systemRowOffers = (property: Partial<PropertyProfile>) => offersOf(property).find(row => row.part === 'blower')?.scopeIds ?? []
assert.ok(systemRowOffers(centralBothProperty).includes('heatPumpReplacement'), 'a central home\'s system row offers a heat pump replacement')
assert.ok(!systemRowOffers(centralBothProperty).includes('heatPumpNewCut'), 'and never a new heat pump')
assert.ok(systemRowOffers(wallFurnace).includes('heatPumpNewCut'), 'a wall home\'s system row offers a new heat pump')
assert.ok(!systemRowOffers(wallFurnace).includes('heatPumpReplacement'), 'and never a heat pump replacement')
assert.ok(!offersOf({ hvacType: 'package-unit' }).some(row => row.scopeIds.some(id => id === 'heatPumpReplacement' || id === 'heatPumpNewCut')), 'a package unit is offered no heat pump')
assert.deepEqual(scopePick(splitPicked, rowOf(splitPicked, 'blower').offer, heatPump).proposedScopeIds, [heatPump], 'a heat pump takes the place of a whole system')
const wallNewCutPicked = inputs(wallFurnace, { proposedScopeIds: [SCOPE_IDS.splitSystemNewCut] })
assert.deepEqual(scopePick(wallNewCutPicked, rowOf(wallNewCutPicked, 'blower').offer, heatPumpNew).proposedScopeIds, [heatPumpNew], 'a new heat pump takes the place of a new system')
for (const [name, property] of [['central both', centralBothProperty], ['wall-mounted', wallFurnace], ['package-unit', { hvacType: 'package-unit' }]] as const) {
  for (const buildSlot of slotsFor(inputs(property)).filter(candidate => candidate.id.startsWith('build:'))) {
    const labels = buildSlot.options.map(option => option.label)
    assert.equal(new Set(labels).size, labels.length, `${name}: ${buildSlot.id} names each job once`)
  }
}
assert.ok(slotIn(inputs(centralBothProperty), 'build:blower')?.options.some(option => option.value === heatPump && option.label === 'Heat pump'), 'a central home names the heat pump Heat pump')
assert.ok(slotIn(inputs(wallFurnace), 'build:blower')?.options.some(option => option.value === heatPumpNew && option.label === 'Heat pump'), 'and so does a wall home')

const heatPumpTargets = scene(centralBothProperty, build([heatPump]))
const heatPumpParts = hvacPartsOf(heatPumpTargets)
const takenOut = heatPumpParts.find(part => part.id === 'furnace')
assert.equal(takenOut?.material, null, 'a heat pump replacement takes the furnace out')
assert.equal(takenOut?.condition, 'installed', 'as work the build does')
assert.equal(takenOut?.label, 'Furnace taken out')
assert.equal(takenOut?.detail, 'The heat pump heats the home, so the gas furnace, its flue and its gas line come out.')
assert.equal(takenOut?.removed, true, 'the furnace is marked taken out')
assert.equal(takenOut?.added, undefined, 'and never added')
assert.deepEqual(['blower', 'coil', 'refrigerant-lines', 'condenser', 'thermostat'].map(id => heatPumpParts.find(part => part.id === id)?.material), ['new-blower', 'high-efficiency-coil', 'copper', 'heat-pump', 'thermostat'], 'a heat pump replacement installs its blower, coil, line set, outdoor unit and thermostat')
assert.equal(heatPumpParts.find(part => part.id === 'condenser')?.label, 'Heat pump outdoor unit')
const takenOutRow = systemPartRows('heating-cooling', heatPumpTargets).find(row => row.id === 'furnace')!
assert.equal(partRowWord(takenOutRow), 'Taken out', 'its row reads Taken out, never New')
assert.equal(PART_COPY.removed, 'Taken out')
assert.equal(partRowWord(systemPartRows('heating-cooling', heatPumpTargets).find(row => row.id === 'coil')!), PART_COPY.condition.installed, 'a part the heat pump replaces reads New')
assert.equal(partRowWord(furnaceSplitRows.find(row => row.id === 'coil')!), PART_COPY.added, 'a part a build adds still reads Added')
const heatPumpLit = systemLit('heating-cooling', systemPartRows('heating-cooling', heatPumpTargets), 'furnace')
assert.ok(!heatPumpLit.shown.has('furnace'), 'a furnace taken out is listed but never drawn up close')
assert.equal(heatPumpLit.emphasized, null, 'so nothing leans at it')
assert.deepEqual(systemPartFocus('heating-cooling', 'pitched', 'coil', 0, heatPumpLit.shown, [], 'attic'), indoorUnitBoxes(indoorUnitPlacement('attic', 'pitched')!, { furnace: false, coil: true }).find(section => section.id === 'coil')!.box.position, 'the coil\'s pin rests on the coil where the closed-up unit draws it')

const skipCopy = { label: 'Gone', detail: 'Taken out.' }
const removable = { ...fixture, parts: fixture.parts.map(part => ({ ...part, materials: { ...part.materials, gone: { copy: skipCopy, removes: true } } })) } as unknown as Assembly
const removedFrom = resolveAssembly(removable, { existing: homeWith(null, 'old'), proposedScopeIds: ['s'], view: 'proposed' }, installsFor([{ part: 'a', material: 'gone' }, { part: 'b', material: 'gone' }]))
assert.deepEqual(removedFrom.find(part => part.id === 'a'), resolved(null, 'old').find(part => part.id === 'a'), 'a part the build takes out where the home has none stays absent')
assert.deepEqual(removedFrom.find(part => part.id === 'b'), { id: 'b', group: 'g', role: 'equipment', removed: true, material: null, condition: 'installed', label: 'Gone', detail: 'Taken out.', thermal: null, water: null }, 'a part the home has is taken out with its own copy')
assert.deepEqual(resolveAssembly(removable, { existing: homeWith(null, 'old'), proposedScopeIds: ['s'], view: 'existing' }, installsFor([{ part: 'b', material: 'gone' }])), resolved(null, 'old'), 'Today takes nothing out')

const wallHeatPump = hvacPartsOf(scene(wallFurnace, build([heatPumpNew])))
assert.equal(wallHeatPump.find(part => part.id === 'furnace')?.condition, 'absent', 'a new heat pump on a wall home brings no furnace')
assert.equal(wallHeatPump.find(part => part.id === 'furnace')?.removed, undefined, 'and takes none out')
for (const id of ['return', 'blower', 'coil', 'plenum', 'duct-runs', 'registers', 'refrigerant-lines', 'condenser']) {
  assert.equal(wallHeatPump.find(part => part.id === id)?.added, true, `a new heat pump on a wall home adds its ${id}`)
}
assert.equal(wallHeatPump.find(part => part.id === 'condenser')?.material, 'heat-pump', 'its outdoor unit is a heat pump')
assert.equal(hvacPartsOf(scene(wallFurnace, { ...build([heatPumpNew]), efficiencyUpgrades: ['r8-ducts'] })).find(part => part.id === 'duct-runs')?.material, 'r8-flex', 'a new heat pump with R-8 lays R-8 ducts')
assert.ok(ductRunDetail(scene(wallFurnace, { ...build([heatPumpNew]), efficiencyUpgrades: ['r8-ducts'] })).endsWith('supported the way code requires.'), 'its R-8 ducts say why they hang')
assert.deepEqual(keepEfficiencyUpgrades(['r8-ducts'], [heatPumpNew]), ['r8-ducts'], 'a new heat pump keeps its R-8')
assert.equal(workDetailsKind(heatPump), 'indoor-unit', 'a heat pump replacement can move its unit')
const heatPumpMovable = moveSlot(closetHomeState(pitchedCentral, [heatPump]))
assert.equal(heatPumpMovable.unavailable, null, 'a pitched closet home with a heat pump replacement can move its unit to the attic')

const heatPumpCuts: [string, Partial<PropertyProfile>, string[], number, number][] = [
  ['central both', centralBothProperty, [heatPump], 0.25, 0],
  ['central furnace', centralFurnaceProperty, [heatPump], 0, 0],
  ['central both', centralBothProperty, [heatPump, ductsScope], 0.2875, 0],
  ['central furnace', centralFurnaceProperty, [heatPump, ductsScope], 0, 0],
  ['wall-mounted', wallFurnace, [heatPumpNew], 0, 0],
]
for (const [home, property, scopes, electric, gas] of heatPumpCuts) {
  const cuts = scene(property, { scopes, view: 'proposed' }).savings.cuts
  const name = `${home}, ${scopes.map(id => scopeName[id]).join(' + ')}`
  near(cuts.electric.combined, electric, `${name}: the electric cut`)
  near(cuts.gas.combined, gas, `${name}: the gas cut`)
}

const heatPumpDrawn = drawn(centralBothProperty, build([heatPump]))
assert.equal(heatPumpDrawn.outdoor?.kind, 'heat-pump', 'a heat pump draws its own outdoor unit')
assert.equal(heatPumpDrawn.indoor?.furnace, null, 'and no furnace')
assert.ok((heatPumpDrawn.indoor?.coil ?? null) !== null, 'but a coil')
assert.deepEqual(heatPumpDrawn.duties, both, 'and it heats and cools')
assert.equal(drawn(centralBothProperty, { scopes: [heatPump] }).outdoor?.kind, 'condenser', 'Today keeps its condenser')
assert.deepEqual(drawn(wallFurnace, build([heatPumpNew])).duties, both, 'a new heat pump heats and cools a wall home')
for (const [name, property, scopes] of [['central both', centralBothProperty, [heatPump]], ['wall-mounted', wallFurnace, [heatPumpNew]]] as const) {
  for (const weather of ['summer', 'winter'] as const) {
    assert.deepEqual(runningOf(weather, property, build([...scopes])), ['blower', 'coil', 'outdoor'], `${name}: a heat pump runs its blower, coil and outdoor unit in ${weather}`)
  }
}
const winterHeatPump = drawn(centralBothProperty, { ...build([heatPump]), weather: 'winter' })
assert.equal(runningZone(hvacRunning(winterHeatPump, 'winter').has('coil'), indoorSide('winter', winterHeatPump.duties), 'attic'), 'heating', 'a heat pump\'s coil reads warm in winter')

const NO_HEAT_PUMP_CLAIM = /tax credit|rebate|required|code|save|saving|lower .*bill|%/i
const heatPumpEntries = [UPGRADE_REGISTRY[heatPump], UPGRADE_REGISTRY[heatPumpNew]]
for (const entry of heatPumpEntries) {
  assert.deepEqual(entry.benefits.map(benefit => [benefit.kind, benefit.title]), [['looks-and-use', 'One outdoor unit heats and cools'], ['protection', 'No flame in the house'], ['looks-and-use', 'A rate plan for heat pump homes'], ['warranty', 'Goodman heat pump']], `${entry.name}: says what a heat pump is`)
  for (const text of [entry.name, ...entry.benefits.flatMap(benefit => [benefit.title, benefit.detail])]) {
    assert.ok(!NO_HEAT_PUMP_CLAIM.test(text), `${entry.name}: claims no credit, rebate, mandate or saving: ${text}`)
  }
}
const heatPumpMaterials = hvacAssembly.parts.flatMap(part => Object.entries(part.materials).filter(([id]) => (part.id === 'furnace' && id === 'removed') || (part.id === 'condenser' && id === 'heat-pump')).map(([id, material]) => ({ id: `${part.id}.${id}`, copy: material.copy })))
assert.deepEqual(heatPumpMaterials.map(material => material.id), ['furnace.removed', 'condenser.heat-pump'], 'the heat pump\'s own materials are read')
for (const { id, copy } of heatPumpMaterials) {
  for (const text of [copy.label, copy.detail]) {
    assert.ok(!NO_HEAT_PUMP_CLAIM.test(text), `${id}: claims no credit, rebate, mandate or saving: ${text}`)
  }
}

// Heating & cooling's view of a unit inside the house sees it from the room it stands in: through the open front, never
// through a wall or partition, the unit's face toward the camera, and a head on the back wall under the ceiling's cut
const CEILING_UNDERSIDE = WALL_TOP_Y - HOUSE.ceilingThickness
const INNER_FRONT = HOUSE.halfDepth - HOUSE.wallThickness
// Every point of the sight line inside the house's walls lies in the room the unit stands in, so it crosses no wall or
// partition on the way; it comes in through the open front.
function sightStaysInRoom(from: Vec3, to: Vec3, room: { from: number, to: number }): boolean {
  const steps = 400
  for (let step = 0; step <= steps; step++) {
    const [x, , z] = [0, 1, 2].map(axis => from[axis]! + (to[axis]! - from[axis]!) * step / steps)
    if (z < INNER_FRONT && (x! < room.from || x! > room.to)) {
      return false
    }
  }
  return true
}
const headTopFront: Vec3 = [MINI_SPLIT_HEADS[0].position[0], MINI_SPLIT_HEADS[0].position[1] + MINI_SPLIT_HEAD_SIZE[1] / 2, MINI_SPLIT_HEADS[0].position[2] - MINI_SPLIT_HEADS[0].outward * MINI_SPLIT_HEAD_SIZE[2]]
for (const form of ROOF_FORMS) {
  for (const shape of ['landscape', 'narrow', 'portrait'] as const) {
    for (const lift of [homeLift('slab'), homeLift('raised')]) {
      const label = `${form} ${shape} lift ${lift.toFixed(2)}`
      const viewOf = (focus: 'mini-split-head' | 'wall-furnace' | 'window-unit') => {
        const { position, target, fov } = SYSTEM_CAMERA_VIEWS['heating-cooling'](form, shape, lift, { focus: { kind: focus }, scale: 1 })
        const lower = (point: readonly number[]): Vec3 => [point[0]!, point[1]! - lift, point[2]!]
        return { position: lower(position), target: lower(target), fov }
      }
      const head = viewOf('mini-split-head')
      assert.ok(sightStaysInRoom(head.position, headTopFront, roomAt(headTopFront[0])), `${label}: the head is seen from inside its own room`)
      const cut = (HOUSE.atticFrontZ - head.position[2]) / (headTopFront[2] - head.position[2])
      const atCut = head.position[1] + (headTopFront[1] - head.position[1]) * cut
      assert.ok(cut > 0 && cut < 1 && atCut < CEILING_UNDERSIDE, `${label}: the sight line to the head's top passes under the ceiling's cut (${atCut.toFixed(3)} m against ${CEILING_UNDERSIDE})`)
      const away = head.position.map((value, axis) => value - head.target[axis]!)
      const polar = Math.acos(away[1]! / Math.hypot(...away))
      assert.ok(polar <= HOME_ORBIT.maxPolarAngle, `${label}: the head's view stands above the orbit's lowest angle, so a touch never moves it (${polar.toFixed(3)})`)
      const toHead = headTopFront.map((value, axis) => value - head.position[axis]!)
      const toAim = head.target.map((value, axis) => value - head.position[axis]!)
      const off = Math.acos(toHead.reduce((sum, value, axis) => sum + value * toAim[axis]!, 0) / Math.hypot(...toHead) / Math.hypot(...toAim))
      assert.ok(off < head.fov / 2 * Math.PI / 180 * 0.8, `${label}: the head stands well inside the frame`)

      const furnace = viewOf('wall-furnace')
      const { facing, position: furnaceAt } = EQUIPMENT.wallFurnace
      assert.ok((furnace.position[0] - furnaceAt[0]) * facing > 0, `${label}: the wall furnace is looked at from the side its face looks to`)
      const furnaceRoom = roomAt(furnaceAt[0] + facing * 0.5)
      const furnaceFace: Vec3 = [furnaceAt[0] + facing * (EQUIPMENT.wallFurnace.size[0] / 2 + 0.01), furnaceAt[1], furnaceAt[2]]
      assert.ok(sightStaysInRoom(furnace.position, furnaceFace, furnaceRoom), `${label}: the wall furnace's face is seen from inside its room`)

      const windowUnit = viewOf('window-unit')
      assert.ok(sightStaysInRoom(windowUnit.position, windowUnit.target, roomAt(EQUIPMENT.windowUnit.x)), `${label}: the window unit is seen from inside its room`)
      for (const [name, view] of [['head', head], ['wall furnace', furnace], ['window unit', windowUnit]] as const) {
        assert.ok(view.position[0] > LOT.left && view.position[0] < LOT.right, `${label}: the ${name}'s view stands between the lot's side walls`)
      }
    }
  }
}

// Each stretch of the indoor unit reads the air in it: the room's air through the blower, warm or cold only where its season
// runs the furnace or the coil and after them, and the air it stands in where the season leaves it idle
function airOf(property: Partial<PropertyProfile>, weather: 'summer' | 'winter' | 'normal', options: SceneOptions = {}) {
  const unit = drawn(property, { ...options, weather })
  const running = hvacRunning(unit, weather)
  const side = indoorSide(weather, unit.duties)
  return Object.fromEntries((['return', 'blower', 'furnace', 'coil', 'plenum'] as const).map(stretch => [stretch, indoorAirZone(stretch, running, side, 'attic')]))
}
assert.deepEqual(airOf({}, 'summer'), { return: 'interior', blower: 'interior', furnace: 'attic', coil: 'cooling', plenum: 'cooling' }, 'in summer the coil and the air after it read cold, the idle furnace the attic')
assert.deepEqual(airOf({}, 'winter'), { return: 'interior', blower: 'interior', furnace: 'heating', coil: 'attic', plenum: 'heating' }, 'in winter the furnace and the air after it read warm, the idle coil the attic')
assert.deepEqual(airOf({}, 'normal'), { return: 'attic', blower: 'attic', furnace: 'attic', coil: 'attic', plenum: 'attic' }, 'a unit standing still reads the attic')
assert.deepEqual(airOf(centralBothProperty, 'winter', build([heatPump])), { return: 'interior', blower: 'interior', furnace: 'attic', coil: 'heating', plenum: 'heating' }, 'a heat pump\'s coil and the air after it read warm in winter')
assert.deepEqual(airOf(centralBothProperty, 'summer', build([heatPump])), { return: 'interior', blower: 'interior', furnace: 'attic', coil: 'cooling', plenum: 'cooling' }, 'and cold in summer')
for (const [name, air] of [['summer', airOf({}, 'summer')], ['winter', airOf({}, 'winter')], ['a heat pump\'s winter', airOf(centralBothProperty, 'winter', build([heatPump]))]] as const) {
  const stage = air.furnace === 'heating' ? air.furnace : air.coil
  assert.notEqual(air.blower, stage, `${name}: the blower never reads as the stage that warms or cools the air`)
}

console.log('verify-heating-cooling: ok')
