import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { Assembly, ExistingConditions, HomeFacts, HomeMaterialFacts, PropertyProfile, ResolvedPart, ScopeInstall, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { hasDucts } from '@/features/trade-scenes/lib/has-ducts'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { resolveInputsOf, selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { scopePick } from '@/features/trade-scenes/lib/scope-pick'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'
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

console.log('verify-heating-cooling: ok')
