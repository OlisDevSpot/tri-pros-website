import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, TradeSceneInputs, Vec3 } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { Assembly, ExistingConditions, HomeFacts, HomeMaterialFacts, PropertyProfile, ResolvedPart, ScopeInstall, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { CONDENSER_LINE_SET, THERMOSTAT_BOX } from '@/features/trade-scenes/constants/home-details'
import { FURNISHING_BOXES, HOME_FURNITURE } from '@/features/trade-scenes/constants/home-furnishings'
import { BACK_INNER, EQUIPMENT, HOME_FLOOR_Y, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { INDOOR_UNIT_PLACEMENTS } from '@/features/trade-scenes/constants/indoor-unit-placements'
import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { drawnHvac } from '@/features/trade-scenes/lib/drawn-hvac'
import { ductRunPoints } from '@/features/trade-scenes/lib/duct-run-points'
import { hasDucts } from '@/features/trade-scenes/lib/has-ducts'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { atticHoldsUnit, indoorLocation } from '@/features/trade-scenes/lib/indoor-location'
import { indoorSide } from '@/features/trade-scenes/lib/indoor-side'
import { indoorUnitBoxes, indoorUnitLineSet } from '@/features/trade-scenes/lib/indoor-unit-boxes'
import { indoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { resolveInputsOf, selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { scopePick } from '@/features/trade-scenes/lib/scope-pick'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { hvacIndoorLocations } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
import { billsPaid } from '@/shared/modules/construction/core/lib/bills-paid'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'
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

const centralBoth = ['registers', 'blower', 'furnace', 'coil', 'plenum', 'duct-runs', 'thermostat', 'refrigerant-lines', 'condenser']
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'both' }), centralBoth, 'a central furnace and A/C has every split component')
assert.deepEqual(presentIds({}), centralBoth, 'an unknown system is a central furnace and A/C')
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'furnace' }), ['registers', 'blower', 'furnace', 'plenum', 'duct-runs', 'thermostat'], 'a furnace alone has no coil, line set or condenser')
assert.deepEqual(presentIds({ hvacType: 'central', hvacComponents: 'ac' }), ['registers', 'blower', 'coil', 'plenum', 'duct-runs', 'thermostat', 'refrigerant-lines', 'condenser'], 'A/C alone has no furnace')
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
  ['central both', { hvacType: 'central', hvacComponents: 'both' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement', 'furnaceReplacement'] }, ducts, minis]],
  ['central furnace', { hvacType: 'central', hvacComponents: 'furnace' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'furnaceReplacement'] }, ducts, minis]],
  ['central ac', { hvacType: 'central', hvacComponents: 'ac' }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement'] }, ducts, minis]],
  ['unknown', { hvacType: null, hvacComponents: null }, [{ part: 'blower', scopeIds: ['splitSystemReplacement', 'acReplacement', 'furnaceReplacement'] }, ducts, minis]],
  ['wall-mounted', { hvacType: 'wall-mounted' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut'] }, minis]],
  ['portable', { hvacType: 'portable' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut'] }, minis]],
  ['mini-split', { hvacType: 'mini-split' }, [{ part: 'blower', scopeIds: ['splitSystemNewCut'] }, minis]],
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
for (const id of ['blower', 'furnace', 'coil', 'plenum', 'duct-runs', 'registers', 'refrigerant-lines', 'condenser']) {
  const part = newCutBuild.find(candidate => candidate.id === id)
  assert.equal(part?.condition, 'installed', `a new system installs its ${id}`)
  assert.equal(part?.added, true, `a wall home gains its ${id}`)
}

// Cooling earns on the electric bill and heating on gas, new ducts land only on a bill the home already pays, and no bill goes up
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
  ['central ac', centralAcProperty, [split], 0.25, 0],
  ['central both', centralBothProperty, [split, ductsScope], 0.2875, 0.24],
  ['central furnace', centralFurnaceProperty, [split, ductsScope], 0, 0.24],
  ['central ac', centralAcProperty, [split, ductsScope], 0.2875, 0],
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
assert.deepEqual([...billsPaid(todayParts(centralAcProperty), hvacAssembly) ?? []], ['electric'], 'A/C alone pays electric')
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
  return drawnHvac(hvacPartsOf(targets), { ...HOME_SCENE_DEFAULTS.property, ...property }, materials, options.view ?? 'existing', homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form), options.scopes ?? [])
}
const build = (scopes: string[], materials: Partial<HomeMaterialFacts> = {}): SceneOptions => ({ scopes, view: 'proposed', materials })
const both = { cools: true, heats: true }
const heatsOnly = { cools: false, heats: true }
const coolsOnly = { cools: true, heats: false }
const flat: Partial<PropertyProfile> = { roofType: 'flat' }
const wallFurnace: Partial<PropertyProfile> = { hvacType: 'wall-mounted', hvacComponents: 'furnace' }

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
assert.equal(acToday.indoor?.furnace, null, 'A/C alone draws no furnace')
assert.deepEqual(acToday.duties, coolsOnly, 'A/C alone only cools')

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

// The indoor side each pair of today's type and components carried before its systems were drawn, as [summer, winter]
const sidesBefore: [HVACType | null, HVACComponent | null, 'cooling' | null, 'heating' | null][] = [
  [null, null, 'cooling', 'heating'],
  [null, 'furnace', null, 'heating'],
  [null, 'ac', 'cooling', null],
  [null, 'both', 'cooling', 'heating'],
  ['central', null, 'cooling', 'heating'],
  ['central', 'furnace', null, 'heating'],
  ['central', 'ac', 'cooling', null],
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
  assert.equal(indoorSide('summer', duties), summer, `${pair}: the summer side is unchanged`)
  assert.equal(indoorSide('winter', duties), winter, `${pair}: the winter side is unchanged`)
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
    const acOnly = indoorUnitBoxes(placement, { furnace: false, coil: true })
    assert.deepEqual(acOnly.map(section => section.id), ['blower', 'coil', 'plenum'], `${name}: a unit with no furnace closes up`)
    const plenumAt = (sections: typeof whole) => along(placement, sections.find(section => section.id === 'plenum')!.box.position)
    assert.ok(Math.abs(plenumAt(whole) - plenumAt(acOnly) - placement.lengths.furnace) < 1e-6, `${name}: and its plenum stands nearer the return by the furnace`)
  }
}
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
  assert.ok(Math.abs(Math.min(...closet.map(wall => wall.position[2] - wall.size[2] / 2)) - BACK_INNER) < 1e-6, `${form}: the closet stands against the back wall`)
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

console.log('verify-heating-cooling: ok')
