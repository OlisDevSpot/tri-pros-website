import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { Assembly, ExistingConditions, HomeMaterialFacts, PropertyProfile, ResolvedPart, ScopeInstall, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { hasDucts } from '@/features/trade-scenes/lib/has-ducts'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { resolveInputsOf, selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
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
interface SceneOptions { scopes?: string[], view?: TradeSceneInputs['view'], weather?: Weather, materials?: Partial<HomeMaterialFacts> }
function scene(property: Partial<PropertyProfile>, { scopes = [], view = 'existing', weather = 'normal', materials = {} }: SceneOptions = {}) {
  const state: TradeSceneInputs = { ...HOME_SCENE_DEFAULTS, property: { ...HOME_SCENE_DEFAULTS.property, ...property }, proposedScopeIds: scopes, view, weather, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, ...materials } }
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

console.log('verify-heating-cooling: ok')
