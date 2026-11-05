import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'
import type { Assembly, ExistingConditions, HeatWeather, HomeFacts, HomeMaterialFacts, PartMaterialDefinition, PropertyProfile, ResolvedPart, ScopeInstall, Season, ThermalReadings } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { yearBuiltRanges } from '@/shared/constants/enums/customers'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'
import { BILL_CUT_ADD_ON_LABELS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import { CLIMATE_PRESETS, CLIMATES, HEAT_WEATHER_PROFILES, THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'
import { INSULATION_LEVEL_LABELS, insulationLevels, roofTypes, wears } from '@/shared/modules/construction/core/constants/enums'
import { INSULATION_BY_ERA } from '@/shared/modules/construction/core/constants/era-defaults'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIAL_FACTS_UNSET, HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { NOT_DRAWN } from '@/shared/modules/construction/core/constants/scope-not-drawn'
import { SCOPES_BY_EXISTING_ROOF } from '@/shared/modules/construction/core/constants/scopes-by-existing-roof'
import { TRADE_BILL_CUTS } from '@/shared/modules/construction/core/constants/trade-bill-cuts'
import { tradeSlugs } from '@/shared/modules/construction/core/constants/trade-slugs'
import { ageBandOf } from '@/shared/modules/construction/core/lib/age-band-of'
import { inferCrawlSpaceExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/crawl-space/infer-existing-conditions'
import { inferExteriorWallExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/exterior-wall/infer-existing-conditions'
import { inferHvacAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/hvac-attic/infer-existing-conditions'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
import { inferWindowsExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/windows/infer-existing-conditions'
import { atticReachable } from '@/shared/modules/construction/core/lib/attic-reachable'
import { combineCuts } from '@/shared/modules/construction/core/lib/combine-cuts'
import { homeAge } from '@/shared/modules/construction/core/lib/home-age'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'
import { installedMaterial } from '@/shared/modules/construction/core/lib/installed-material'
import { redeckAllowed } from '@/shared/modules/construction/core/lib/redeck-allowed'
import { relativeHeatFlow } from '@/shared/modules/construction/core/lib/relative-heat-flow'
import { relativeWaterFlow } from '@/shared/modules/construction/core/lib/relative-water-flow'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials, wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'
import { thermalWalk } from '@/shared/modules/construction/core/lib/thermal-walk'
import { wearForAge } from '@/shared/modules/construction/core/lib/wear-for-age'

const SEASONS = ['summer', 'winter'] as const satisfies readonly Season[]

const liveSlugs = new Set<string>(tradeSlugs)

// The registry: five assemblies, each keyed by its own id, trades live, parts unique, every part drawable.
assert.deepEqual(Object.keys(ASSEMBLIES).sort(), [...ASSEMBLY_IDS].sort(), 'one entry per assembly id')
for (const id of ASSEMBLY_IDS) {
  const assembly = ASSEMBLIES[id]
  assert.equal(assembly.id, id, `${id}: id matches its key`)
  assert.ok(assembly.trades.length > 0 && assembly.trades.every(trade => liveSlugs.has(trade)), `${id}: trades are live slugs`)
  const partIds = assembly.parts.map(part => part.id)
  assert.equal(new Set(partIds).size, partIds.length, `${id}: part ids are unique`)
  for (const part of assembly.parts) {
    const materials = Object.entries(part.materials)
    assert.ok(materials.length > 0, `${id}/${part.id}: has a material`)
    for (const [material, definition] of materials) {
      assert.ok(definition.copy.label && definition.copy.detail, `${id}/${part.id}/${material}: has homeowner copy`)
      assert.ok(!definition.forms || definition.forms.every(form => assembly.forms?.includes(form)), `${id}/${part.id}/${material}: forms exist on the assembly`)
      const rValue = definition.thermal?.rValue
      for (const reflectance of [definition.thermal?.reflectance, definition.thermal?.winterReflectance]) {
        assert.ok(reflectance === undefined || (reflectance >= 0 && reflectance < 1), `${id}/${part.id}/${material}: reflectance ${reflectance} is within 0..1, never a perfect mirror`)
      }
      assert.ok(rValue === undefined || rValue >= 0, `${id}/${part.id}/${material}: R-value ${rValue} is zero or more`)
    }
    assert.ok(!part.forms || part.forms.every(form => assembly.forms?.includes(form)), `${id}/${part.id}: forms exist on the assembly`)
  }
}

// Every scope install names a real part and material, and some form of its assembly can hold all of it at once;
// the resolver would otherwise throw or skip it in a meeting. The live check adds the Notion side.
for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
  if (!entry) {
    continue
  }
  const assembly: Assembly = ASSEMBLIES[entry.assembly]
  const installed = entry.installs.map(({ part, material, swapsWith }) => {
    const partDefinition = assembly.parts.find(candidate => candidate.id === part)
    assert.ok(partDefinition, `${scopeId}: ${entry.assembly} has no part ${part}`)
    const materialDefinition = partDefinition.materials[material]
    assert.ok(materialDefinition, `${scopeId}: ${entry.assembly}/${part} has no material ${material}`)
    // A swap built on fewer forms would drop the covering while the add-on's bill cut still counts.
    for (const [addOn, swap] of Object.entries(swapsWith ?? {})) {
      const swapDefinition: PartMaterialDefinition | undefined = partDefinition.materials[swap]
      assert.ok(swapDefinition, `${scopeId}: ${addOn} swaps ${entry.assembly}/${part} to ${swap}, which it does not offer`)
      assert.deepEqual(swapDefinition.forms, materialDefinition.forms, `${scopeId}: ${addOn}'s ${swap} builds on the same forms as ${material}`)
    }
    return { partForms: partDefinition.forms, materialForms: materialDefinition.forms }
  })
  const holds = (form: string | null) => installed.every(({ partForms, materialForms }) =>
    [partForms, materialForms].every(forms => !forms || (form !== null && forms.includes(form))))
  assert.ok((assembly.forms ?? [null]).some(holds), `${scopeId}: no single ${entry.assembly} form holds everything it installs`)
}

// Thermal assemblies list parts inside to out; the first part is the one facing the living space.
const livingSpaceFacePart = {
  'roof-attic': 'ceiling',
  'crawl-space': 'subfloor',
  'exterior-wall': 'drywall',
  'hvac-attic': 'air-handler',
  'windows': 'glazing',
} as const
for (const [id, partId] of Object.entries(livingSpaceFacePart)) {
  assert.equal(ASSEMBLIES[id as keyof typeof livingSpaceFacePart].parts[0]?.id, partId, `${id}: first part faces the living space`)
}
for (const id of ASSEMBLY_IDS) {
  if (ASSEMBLIES[id].modes.summer === 'thermal')
    assert.ok(id in livingSpaceFacePart, `${id}: thermal assembly has a pinned living-space face`)
}
for (const id of ASSEMBLY_IDS) {
  assert.ok(Object.keys(ASSEMBLIES[id].modes).length > 0, `${id}: carries at least one mode`)
}
assert.equal(ASSEMBLIES['roof-attic'].modes.rain, 'water', 'the roof sheds rain')
assert.equal(ASSEMBLIES['yard-ground'].modes.rain, 'water', 'the yard takes rain')
assert.equal(ASSEMBLIES['roof-attic'].readings?.outerGroup, 'roof', 'the roof group lies outside the attic air')
assert.deepEqual(ASSEMBLIES['roof-attic'].parts.filter(part => part.edge).map(part => part.id).sort(), ['drip-edge', 'gutter'], 'the edge fittings collect shed water')
assert.equal(ASSEMBLIES['yard-ground'].parts.find(part => part.id === 'irrigation')?.materials['line-and-heads']?.water?.demand, undefined, 'irrigation supplies; the surface sets demand')

assert.equal(ASSEMBLIES['crawl-space'].appliesTo?.({ yearBuilt: null, roofType: null, foundationType: 'slab', hvacType: null, insulationLevel: null, windowsType: null, hvacComponents: null }), false, 'no crawl space on a slab')
assert.equal(ASSEMBLIES['crawl-space'].appliesTo?.({ yearBuilt: null, roofType: null, foundationType: 'raised', hvacType: null, insulationLevel: null, windowsType: null, hvacComponents: null }), true, 'a crawl space on a raised foundation')
assert.deepEqual([...ASSEMBLIES['crawl-space'].trades].sort(), ['attic-and-basement', 'foundation-and-crawl-space'], 'the crawl space belongs to attic and basement and to foundation and crawl space, raised foundations only')

const roofAttic = ASSEMBLIES['roof-attic']
function inferRoof(property: PropertyProfile) {
  const homeFacts = facts(property)
  return inferRoofAtticExistingConditions(homeFacts, resolveHomeMaterials(homeFacts))
}
const profile = (patch: Partial<PropertyProfile>): PropertyProfile => ({ yearBuilt: '1950-1978', roofType: 'shingle', foundationType: 'slab', hvacType: 'central', insulationLevel: 'r11', windowsType: null, hvacComponents: null, ...patch })

// Basis: "recorded" only when every input was recorded and draws exactly.
for (const roofType of [...roofTypes, null]) {
  for (const yearBuilt of [...yearBuiltRanges, null]) {
    for (const insulationLevel of [...insulationLevels, null]) {
      const existing = inferRoof(profile({ roofType, yearBuilt, insulationLevel }))
      const exact = roofType === 'shingle' || roofType === 'tile' || roofType === 'flat' || roofType === 'woodshake'
      const expected = yearBuilt === null ? 'typical' : exact && insulationLevel !== null ? 'recorded' : 'era-typical'
      assert.equal(existing.basis, expected, `basis for ${roofType}/${yearBuilt}/${insulationLevel}`)
      const coveringForms = roofAttic.parts.find(part => part.id === 'covering')!.materials[existing.parts.covering.material!]!.forms as readonly string[] | undefined
      assert.ok(!coveringForms || coveringForms.includes(existing.form!), `inferred covering fits its form for ${roofType}`)
      for (const part of resolveAssembly(roofAttic, { existing, proposedScopeIds: [], view: 'existing' })) {
        assert.ok(part.label && part.detail, `${roofType}/${yearBuilt}/${insulationLevel}: ${part.id} has wording`)
      }
    }
  }
}

// Form and covering follow the roof type.
assert.equal(inferRoof(profile({ roofType: 'flat' })).form, 'low-slope')
assert.equal(inferRoof(profile({ roofType: 'flat' })).parts.covering.material, 'membrane')
assert.equal(inferRoof(profile({ roofType: 'tile' })).parts.covering.material, 'tile')
assert.equal(inferRoof(profile({ roofType: 'metal' })).parts.covering.material, 'shingle', 'nearest drawing')
const shakeHome = inferRoof(profile({ roofType: 'woodshake' }))
assert.equal(shakeHome.parts.covering.material, 'wood-shake', 'shakes draw as themselves')
assert.equal(shakeHome.parts.deck.material, 'spaced-boards', 'shakes sit on spaced boards')
assert.equal(shakeHome.basis, 'recorded', 'a recorded wood-shake profile is exact')
assert.equal(inferRoof(profile({ insulationLevel: 'r19' })).parts['attic-insulation'].material, 'batts-r19')
assert.deepEqual([...insulationLevels], ['none', 'r11', 'r19', 'r30', 'r38'], 'insulation levels are named by R-value')
assert.equal(INSULATION_LEVEL_LABELS.r38, '12 in. (R-38)', 'one set of depth and R-value labels')
assert.equal(inferRoof(profile({ insulationLevel: 'r38' })).parts['attic-insulation'].material, 'blown-r38')
assert.equal(inferRoof(profile({ insulationLevel: 'none' })).parts['attic-insulation'].material, null, 'none infers absent')
assert.equal(INSULATION_BY_ERA['Post-2014'], 'r30', 'the newest era guess is R-30')
assert.equal(inferRoof(profile({ insulationLevel: null, yearBuilt: 'Post-2014' })).parts['attic-insulation'].material, 'batts-r30', 'era fallback')

// Spaced boards only ever sit under wood shakes.
for (const yearBuilt of yearBuiltRanges) {
  for (const roofType of roofTypes) {
    const deck = inferRoof(profile({ roofType, yearBuilt })).parts.deck.material
    assert.equal(deck, roofType === 'woodshake' ? 'spaced-boards' : 'plywood', `deck for ${roofType}/${yearBuilt}`)
  }
}

// A low-slope roof with no recorded insulation draws no batts; a recorded level still does.
assert.equal(inferRoof(profile({ roofType: 'flat', insulationLevel: null })).parts['attic-insulation'].material, null, 'no era guess under a flat roof')
assert.equal(inferRoof(profile({ roofType: 'flat', insulationLevel: null })).parts['attic-insulation'].condition, 'absent')
assert.equal(inferRoof(profile({ roofType: 'flat', insulationLevel: 'r11' })).parts['attic-insulation'].material, 'batts-r11')

// A new covering that cannot be fastened to spaced boards brings its solid deck.
for (const roofType of roofTypes) {
  const parts = resolveAssembly(roofAttic, { existing: inferRoof(profile({ roofType })), proposedScopeIds: [SCOPE_IDS.roofTearOff], view: 'proposed' })
  const covering = parts.find(part => part.id === 'covering')!.material
  const deck = parts.find(part => part.id === 'deck')!.material
  assert.ok(!(['shingle', 'cool-shingle', 'tile'].includes(covering!) && deck === 'spaced-boards'), `tear-off on ${roofType} never leaves a covering on spaced boards`)
}
const shakeTearOff = resolveAssembly(roofAttic, { existing: shakeHome, proposedScopeIds: [SCOPE_IDS.roofTearOff], view: 'proposed' }).find(part => part.id === 'deck')!
assert.equal(shakeTearOff.material, 'plywood')
assert.equal(shakeTearOff.condition, 'installed')
assert.equal(shakeTearOff.label, 'New solid decking, needed for the new roof')

// A low-slope roof has no ridge vent part at all.
const flat = inferRoof(profile({ roofType: 'flat' }))
assert.ok(!resolveAssembly(roofAttic, { existing: flat, proposedScopeIds: [], view: 'existing' }).some(part => part.id === 'ridge-vent'))
assert.ok(resolveAssembly(roofAttic, { existing: inferRoof(profile({})), proposedScopeIds: [], view: 'existing' }).some(part => part.id === 'ridge-vent'))

// Proposed view installs what the previewed scopes install; the existing view ignores them.
const fakeInstalls: Partial<Record<string, ScopeInstall>> = {
  'scope-reroof': { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'covering', material: 'cool-shingle' }, { part: 'ice-and-water', material: 'membrane' }] },
  'scope-elsewhere': { assembly: 'exterior-wall', trade: 'exterior-paint-stucco-and-siding', installs: [{ part: 'paint', material: 'cool' }] },
}
const existing = inferRoof(profile({}))
const proposed = resolveAssembly(roofAttic, { existing, proposedScopeIds: ['scope-reroof', 'scope-elsewhere', 'scope-unknown'], view: 'proposed' }, fakeInstalls)
const covering = proposed.find(part => part.id === 'covering')!
assert.equal(covering.material, 'cool-shingle')
assert.equal(covering.condition, 'installed')
assert.equal(proposed.find(part => part.id === 'ice-and-water')!.condition, 'installed')
assert.equal(proposed.find(part => part.id === 'rafters')!.condition, 'retained')
assert.equal(resolveAssembly(roofAttic, { existing, proposedScopeIds: ['scope-reroof'], view: 'existing' }, fakeInstalls).find(part => part.id === 'covering')!.condition, 'worn')
assert.equal(proposed.find(part => part.id === 'ice-and-water')!.label, 'Self-sealing eave membrane')
assert.equal(resolveAssembly(roofAttic, { existing, proposedScopeIds: [], view: 'existing' }).find(part => part.id === 'ice-and-water')!.label, 'No eave membrane', 'absent copy')
assert.equal(covering.thermal?.reflectance, 0.3)

// Install data fails loudly; an unknown scope id is a no-op.
const installView = (installs: Partial<Record<string, ScopeInstall>>, form: ExistingConditions) => resolveAssembly(roofAttic, { existing: form, proposedScopeIds: ['s'], view: 'proposed' }, installs)
const onlyInstall = (part: string, material: string): Partial<Record<string, ScopeInstall>> => ({ s: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part, material }] } })
const coveringOf = (parts: ReturnType<typeof installView>) => parts.find(part => part.id === 'covering')!
const asExisting = (form: ExistingConditions) => coveringOf(resolveAssembly(roofAttic, { existing: form, proposedScopeIds: [], view: 'proposed' }, {}))
assert.deepEqual(coveringOf(installView(onlyInstall('covering', 'shingle'), flat)), asExisting(flat), 'mismatched covering install is skipped (covering stays as existing): shingle on a low-slope roof')
assert.deepEqual(coveringOf(installView(onlyInstall('covering', 'membrane'), existing)), asExisting(existing), 'mismatched covering install is skipped (covering stays as existing): membrane on a pitched roof')
assert.equal(installView(onlyInstall('covering', 'membrane'), flat).find(part => part.id === 'covering')!.material, 'membrane')
assert.equal(installView(onlyInstall('covering', 'tile'), existing).find(part => part.id === 'covering')!.condition, 'installed')
assert.throws(() => installView(onlyInstall('chimney', 'brick'), existing), /s.*chimney/, 'unknown part')
assert.throws(() => installView(onlyInstall('covering', 'slate'), existing), /s.*slate.*covering/, 'unknown material')
assert.deepEqual(resolveAssembly(roofAttic, { existing, proposedScopeIds: ['nope'], view: 'proposed' }, {}), resolveAssembly(roofAttic, { existing, proposedScopeIds: [], view: 'proposed' }, {}), 'unknown scope id is a no-op')

// A bad needsBase fails loudly, even on a home whose deck it would not touch.
function withShingleBase(needsBase: { part: string, replaces: readonly string[], with: string }): Assembly {
  return {
    ...roofAttic,
    parts: roofAttic.parts.map(part => part.id === 'covering'
      ? { ...part, materials: { ...part.materials, shingle: { ...part.materials.shingle, needsBase: { ...needsBase, copy: { label: 'Base', detail: 'Base.' } } } } }
      : part),
  }
}
const installShingle = (assembly: Assembly) => resolveAssembly(assembly, { existing, proposedScopeIds: ['s'], view: 'proposed' }, onlyInstall('covering', 'shingle'))
assert.throws(() => installShingle(withShingleBase({ part: 'chimney', replaces: ['spaced-boards'], with: 'plywood' })), /shingle.*chimney/, 'needsBase on an unknown part')
assert.throws(() => installShingle(withShingleBase({ part: 'deck', replaces: ['spaced-boards'], with: 'osb' })), /shingle.*osb.*deck/, 'needsBase with an unknown material')

// The cool roof is an add-on on Roof & gutters: it swaps the covering only where the scope names a swap.
const tileHome = inferRoof(profile({ roofType: 'tile' }))
function proposedPart(form: ExistingConditions, scopeId: string, efficiencyUpgrades: readonly EfficiencyUpgradeId[] | undefined, partId: string) {
  return resolveAssembly(roofAttic, { existing: form, proposedScopeIds: [scopeId], view: 'proposed', efficiencyUpgrades }).find(part => part.id === partId)!
}
assert.equal(proposedPart(existing, SCOPE_IDS.roofTearOff, [], 'covering').material, 'shingle', 'tear-off without the cool roof installs standard shingles')
assert.equal(proposedPart(existing, SCOPE_IDS.roofTearOff, undefined, 'covering').material, 'shingle', 'no efficiency upgrades by default')
assert.equal(proposedPart(existing, SCOPE_IDS.roofTearOff, ['cool-roof'], 'covering').material, 'cool-shingle', 'tear-off with the cool roof installs cool shingles')
assert.equal(proposedPart(existing, SCOPE_IDS.roofTearOff, ['cool-roof'], 'covering').condition, 'installed')
assert.equal(proposedPart(existing, SCOPE_IDS.roofOverlay, ['cool-roof'], 'covering').material, 'cool-shingle', 'overlay with the cool roof installs cool shingles')
assert.equal(proposedPart(flat, SCOPE_IDS.roofTorchDown, [], 'covering').material, 'membrane', 'torch down without the cool roof')
assert.equal(proposedPart(flat, SCOPE_IDS.roofTorchDown, ['cool-roof'], 'covering').material, 'cool-membrane', 'torch down with the cool roof installs a cool membrane')
assert.equal(proposedPart(tileHome, SCOPE_IDS.roofTileReset, ['cool-roof'], 'covering').material, 'tile', 'tile reset ignores the cool roof')
assert.equal(proposedPart(existing, SCOPE_IDS.roofTearOff, ['cool-roof'], 'covering').thermal?.reflectance, 0.3, 'the swapped covering carries its own thermal data')
// The swap runs before the deck pass, so cool shingles over spaced boards still bring their solid deck.
assert.equal(proposedPart(shakeHome, SCOPE_IDS.roofTearOff, ['cool-roof'], 'covering').material, 'cool-shingle')
assert.equal(proposedPart(shakeHome, SCOPE_IDS.roofTearOff, ['cool-roof'], 'deck').material, 'plywood', 'cool shingles on a shake home bring solid decking')
const shakesOrCool: Partial<Record<string, ScopeInstall>> = { s: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'covering', material: 'wood-shake', swapsWith: { 'cool-roof': 'cool-shingle' } }] } }
const shakeDeck = (efficiencyUpgrades: readonly EfficiencyUpgradeId[]) => resolveAssembly(roofAttic, { existing: shakeHome, proposedScopeIds: ['s'], view: 'proposed', efficiencyUpgrades }, shakesOrCool).find(part => part.id === 'deck')!.material
assert.equal(shakeDeck([]), 'spaced-boards', 'shakes need no solid deck')
assert.equal(shakeDeck(['cool-roof']), 'plywood', 'only the swapped material needs the deck, so the deck pass must see the swap')

// Every assembly resolves both views with no assembly-specific branch.
function neutralExisting(id: keyof typeof ASSEMBLIES): ExistingConditions {
  const assembly: Assembly = ASSEMBLIES[id]
  return {
    form: assembly.forms?.[0] ?? null,
    parts: Object.fromEntries(assembly.parts.map(part => [part.id, { material: Object.keys(part.materials)[0], condition: 'worn' as const }])),
    basis: 'typical',
  }
}
for (const id of ASSEMBLY_IDS) {
  for (const view of ['existing', 'proposed'] as const) {
    const parts = resolveAssembly(ASSEMBLIES[id], { existing: neutralExisting(id), proposedScopeIds: [], view })
    assert.ok(parts.length > 0 && parts.every(part => part.label && part.detail), `${id}/${view} resolves with wording`)
    const profiles = ASSEMBLIES[id].modes.summer === 'thermal'
      ? SEASONS.flatMap(season => CLIMATES.map(climate => relativeHeatFlow(ASSEMBLIES[id], parts, season, climate)))
      : [relativeWaterFlow(parts, 'irrigation')]
    for (const profile of profiles) {
      assert.equal(profile.boundaries.length, parts.length + 1, `${id}/${view}: one boundary per part edge`)
      profile.boundaries.forEach((flow, index) => {
        assert.ok(Number.isFinite(flow) && flow >= 0 && flow <= 1, `${id}/${view}: flow ${flow} is within 0..1`)
        assert.ok(index === 0 || flow <= profile.boundaries[index - 1] + 1e-12, `${id}/${view}: flow never grows along the walk`)
      })
      for (const [partId, face] of Object.entries(profile.parts)) {
        assert.ok([face.inner, face.outer].every(value => Number.isFinite(value) && value >= 0 && value <= 1), `${id}/${view}/${partId}: paint sits on the thermal scale`)
      }
    }
    if (ASSEMBLIES[id].modes.summer === 'thermal') {
      const summer = profiles[0]
      assert.ok(Math.abs(summer.boundaries[0] - (1 - summer.reflected)) < 1e-12, `${id}/${view}: first boundary is what the surface lets in`)
    }
  }
}

const resolverSource = readFileSync('src/shared/modules/construction/core/lib/resolve-assembly.ts', 'utf8')
for (const id of ASSEMBLY_IDS) {
  assert.ok(!resolverSource.includes(`'${id}'`), `the resolver has no ${id} branch`)
}

// Heat flow: ribbon widths are drawn relative; the paint sits on the same °F walk as the readings.
const before = resolveAssembly(roofAttic, { existing, proposedScopeIds: [], view: 'existing' })
const atticInstalls: Partial<Record<string, ScopeInstall>> = {
  'scope-attic': { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-insulation', material: 'blown-r38' }] },
  'scope-cool': { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'covering', material: 'cool-shingle' }] },
}
const after = resolveAssembly(roofAttic, { existing, proposedScopeIds: ['scope-attic', 'scope-cool'], view: 'proposed' }, atticInstalls)
const heat = (parts: ResolvedPart[], season: HeatWeather, climate: Climate = 'inland') => relativeHeatFlow(roofAttic, parts, season, climate)

const summerBefore = heat(before, 'summer')
const summerAfter = heat(after, 'summer')
assert.equal(summerBefore.boundaries.length, before.length + 1)
assert.ok(summerAfter.boundaries.at(-1)! < summerBefore.boundaries.at(-1)!, 'R-38 + cool roof lets less heat into the room than R-11')
assert.ok(summerAfter.reflected > summerBefore.reflected, 'the cool roof sends more back to the sky')
for (const profile of [summerBefore, summerAfter]) {
  profile.boundaries.forEach((flow, index) => index > 0 && assert.ok(flow <= profile.boundaries[index - 1] + 1e-12, 'flow never grows as it crosses parts'))
}
assert.ok(summerBefore.parts.covering.outer > summerBefore.parts.ceiling.inner, 'summer: the roof is hotter than the ceiling')

const winter = heat(before, 'winter')
assert.equal(winter.reflected, 0, 'the ceiling sends nothing back in winter')
assert.ok(winter.parts.ceiling.inner > winter.parts.covering.outer, 'winter: the room is warmer than the roof')
assert.ok(heat(after, 'winter').boundaries.at(-1)! < winter.boundaries.at(-1)!, 'R-38 holds more heat in')

// The paint is the readings walk on the thermal scale, so a painted colour and a pinned °F never disagree.
const onThermalScale = (value: number) => Math.min(1, Math.max(0, (value - THERMAL_SCALE_F.min) / (THERMAL_SCALE_F.max - THERMAL_SCALE_F.min)))
for (const season of SEASONS) {
  for (const climate of CLIMATES) {
    const { faces } = thermalWalk(roofAttic, before, season, climate)
    const paint = heat(before, season, climate).parts
    for (const part of before) {
      assert.ok(Math.abs(paint[part.id].outer - onThermalScale(faces[part.id].outer)) < 1e-12 && Math.abs(paint[part.id].inner - onThermalScale(faces[part.id].inner)) < 1e-12, `${season}/${climate}/${part.id}: paint matches the readings walk`)
    }
  }
}

// Drawing scale: Today (R-11) stays readable; the full build is clearly narrower.
const buildOf = (...installs: { part: string, material: string }[]) => resolveAssembly(roofAttic, { existing, proposedScopeIds: ['s'], view: 'proposed' }, { s: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs } })
const finalSummer = (parts: typeof before) => heat(parts, 'summer').boundaries.at(-1)!
const r38 = { part: 'attic-insulation', material: 'blown-r38' }
const barrier = { part: 'radiant-barrier', material: 'foil' }
const coolShingle = { part: 'covering', material: 'cool-shingle' }
const todayFinal = finalSummer(before)
assert.ok(todayFinal >= 0.3, `Today's summer ribbon stays readable (${todayFinal})`)
assert.ok(finalSummer(buildOf(r38, barrier)) <= 0.4 * todayFinal, 'R-38 + radiant barrier ends at most 0.4 of Today')

// Final ribbon widths for Today, R-38, + radiant barrier, + cool roof. The barrier holds heat in through winter too.
const ribbonBuilds = [before, buildOf(r38), buildOf(r38, barrier), buildOf(r38, barrier, coolShingle)]
const finalWidths = (season: Season) => ribbonBuilds.map(parts => Number(heat(parts, season).boundaries.at(-1)!.toFixed(2)))
assert.deepEqual(finalWidths('summer'), [0.55, 0.3, 0.12, 0.09], 'summer final widths')
assert.deepEqual(finalWidths('winter'), [0.61, 0.34, 0.27, 0.27], 'winter final widths')
for (const parts of ribbonBuilds) {
  for (const season of SEASONS) {
    assert.deepEqual(heat(parts, season, 'coastal').boundaries, heat(parts, season, 'inland').boundaries, 'ribbon widths do not depend on the climate')
  }
}

// A radiant barrier sits under the deck: it narrows what comes after it, not the ribbon at the shingles.
const withBarrier = buildOf(barrier)
const barrierSummer = heat(withBarrier, 'summer')
assert.equal(barrierSummer.boundaries[0], summerBefore.boundaries[0], 'a radiant barrier leaves the first boundary alone')
assert.equal(barrierSummer.reflected, summerBefore.reflected, 'a radiant barrier is not the sky-facing reflection')
const barrierIndex = before.length - 1 - before.findIndex(part => part.id === 'radiant-barrier') + 1
assert.ok(barrierSummer.boundaries[barrierIndex] < summerBefore.boundaries[barrierIndex], 'it narrows the boundary after the barrier')
assert.deepEqual(barrierSummer.boundaries.slice(0, barrierIndex), summerBefore.boundaries.slice(0, barrierIndex), 'nothing before the barrier changes')

// In winter the barrier turns some of the room's heat back down, less than it turns back of the summer sun.
function shareTurnedBack(parts: ResolvedPart[], season: Season): number {
  const { boundaries } = heat(parts, season)
  const fromSource = season === 'summer' ? [...parts].reverse() : parts
  const at = fromSource.findIndex(part => part.id === 'radiant-barrier')
  return boundaries[at] - boundaries[at + 1]
}
const winterShare = shareTurnedBack(withBarrier, 'winter')
assert.ok(winterShare > 0, `the barrier turns heat back in winter (${winterShare})`)
assert.ok(winterShare < shareTurnedBack(withBarrier, 'summer'), 'less in winter than in summer')
assert.equal(shareTurnedBack(before, 'winter'), 0, 'no barrier, nothing turned back')
assert.ok(heat(withBarrier, 'winter').boundaries.at(-1)! < winter.boundaries.at(-1)!, 'winter: less heat leaves through a roof with a barrier')

// Readings: °F at the roof surface, the attic air and the ceiling surface, from a climate preset.
const readingsOf = (parts: ResolvedPart[], season: HeatWeather, climate: Climate) => thermalWalk(roofAttic, parts, season, climate).readings
function cavityOf(readings: ThermalReadings): number {
  assert.ok(readings.cavityAir !== null, 'the roof reads its attic air')
  return readings.cavityAir
}

// Calibration: a 1950–1978 shingle home with R-11 on an inland summer afternoon.
const calibration = readingsOf(before, 'summer', 'inland')
assert.equal(before.find(part => part.id === 'attic-insulation')!.material, 'batts-r11')
assert.ok(calibration.outerSurface >= 160 && calibration.outerSurface <= 180, `roof surface ${calibration.outerSurface} °F is within 160–180`)
assert.ok(cavityOf(calibration) >= 130 && cavityOf(calibration) <= 150, `attic air ${calibration.cavityAir} °F is within 130–150`)
assert.ok(calibration.innerSurface >= 78 && calibration.innerSurface <= 82, `ceiling surface ${calibration.innerSurface} °F is within 78–82`)

// The readings land on the walk's faces: the covering's outside, the attic air above the batts, the ceiling's underside.
for (const season of SEASONS) {
  for (const climate of CLIMATES) {
    for (const parts of [before, withBarrier]) {
      const { readings, faces } = thermalWalk(roofAttic, parts, season, climate)
      assert.ok(Math.abs(faces.covering.outer - readings.outerSurface) < 1e-9, `${season}/${climate}: the roof surface reading is the covering's outer face`)
      assert.ok(Math.abs(faces.ceiling.inner - readings.innerSurface) < 1e-9, `${season}/${climate}: the ceiling reading is the ceiling's inner face`)
      assert.ok(Math.abs(faces['attic-insulation'].outer - cavityOf(readings)) < 1e-9, `${season}/${climate}: the top of the insulation sits in the attic air`)
      assert.ok(Math.abs(faces.rafters.inner - cavityOf(readings)) < 1e-9, `${season}/${climate}: the roof path ends in the attic air`)
    }
  }
}

// Each improvement moves the reading it should.
const roofTearOff = (efficiencyUpgrades: readonly EfficiencyUpgradeId[]) => resolveAssembly(roofAttic, { existing, proposedScopeIds: [SCOPE_IDS.roofTearOff], view: 'proposed', efficiencyUpgrades })
for (const climate of CLIMATES) {
  assert.ok(readingsOf(buildOf(r38), 'summer', climate).innerSurface < readingsOf(before, 'summer', climate).innerSurface, `${climate}: R-38 cools the ceiling in summer`)
  assert.ok(readingsOf(roofTearOff(['cool-roof']), 'summer', climate).outerSurface < readingsOf(roofTearOff([]), 'summer', climate).outerSurface, `${climate}: the cool roof cools the roof surface`)
  assert.deepEqual(readingsOf(roofTearOff([]), 'summer', climate), readingsOf(buildOf({ part: 'covering', material: 'shingle' }), 'summer', climate), `${climate}: a roof scope without the cool roof reads as a standard covering`)
  assert.ok(cavityOf(readingsOf(withBarrier, 'summer', climate)) < cavityOf(readingsOf(before, 'summer', climate)), `${climate}: the radiant barrier cools the attic air in summer`)
  assert.ok(cavityOf(readingsOf(withBarrier, 'winter', climate)) > cavityOf(readingsOf(before, 'winter', climate)), `${climate}: the radiant barrier warms the attic air in winter`)
}
for (const parts of [before, after, withBarrier]) {
  const inland = readingsOf(parts, 'summer', 'inland')
  const coastal = readingsOf(parts, 'summer', 'coastal')
  assert.ok(inland.outerSurface > coastal.outerSurface && cavityOf(inland) > cavityOf(coastal) && inland.innerSurface > coastal.innerSurface, 'inland reads hotter than coastal in summer')
  const inlandWinter = readingsOf(parts, 'winter', 'inland')
  const coastalWinter = readingsOf(parts, 'winter', 'coastal')
  assert.ok(inlandWinter.outerSurface < coastalWinter.outerSurface && cavityOf(inlandWinter) < cavityOf(coastalWinter) && inlandWinter.innerSurface < coastalWinter.innerSurface, 'inland reads colder than coastal in winter')
}

// Every reading and face across roof type × era × insulation × view × climate × season sits on the thermal scale.
const readingViews = ['existing', 'proposed', 'proposed + cool roof'] as const
function viewParts(home: ExistingConditions, view: (typeof readingViews)[number]): ResolvedPart[] {
  if (view === 'existing') {
    return resolveAssembly(roofAttic, { existing: home, proposedScopeIds: [], view: 'existing' })
  }
  const roofScope = home.form === 'low-slope' ? SCOPE_IDS.roofTorchDown : home.parts.covering.material === 'tile' ? SCOPE_IDS.roofTileReset : SCOPE_IDS.roofTearOff
  const proposedScopeIds = [roofScope, SCOPE_IDS.airSealing, SCOPE_IDS.atticInsulationReplacement, SCOPE_IDS.radiantBarrier, SCOPE_IDS.gutters]
  return resolveAssembly(roofAttic, { existing: home, proposedScopeIds, view: 'proposed', efficiencyUpgrades: view === 'proposed' ? [] : ['cool-roof'] })
}
const inScale = (value: number) => Number.isFinite(value) && value >= THERMAL_SCALE_F.min && value <= THERMAL_SCALE_F.max
for (const roofType of [...roofTypes, null]) {
  for (const yearBuilt of [...yearBuiltRanges, null]) {
    for (const insulationLevel of [...insulationLevels, null]) {
      const home = inferRoof(profile({ roofType, yearBuilt, insulationLevel }))
      for (const view of readingViews) {
        const parts = viewParts(home, view)
        for (const season of SEASONS) {
          for (const climate of CLIMATES) {
            const { readings, faces } = thermalWalk(roofAttic, parts, season, climate)
            const where = `${roofType}/${yearBuilt}/${insulationLevel}/${view}/${season}/${climate}`
            assert.ok(inScale(readings.outerSurface) && inScale(cavityOf(readings)) && inScale(readings.innerSurface), `${where}: readings ${JSON.stringify(readings)} sit on the thermal scale`)
            for (const [partId, face] of Object.entries(faces)) {
              assert.ok(inScale(face.inner) && inScale(face.outer), `${where}/${partId}: faces ${JSON.stringify(face)} sit on the thermal scale`)
            }
          }
        }
      }
    }
  }
}

// A flat roof with no recorded insulation still reads through the joist space.
const flatUnknown = resolveAssembly(roofAttic, { existing: inferRoof(profile({ roofType: 'flat', insulationLevel: null })), proposedScopeIds: [], view: 'existing' })
assert.equal(flatUnknown.find(part => part.id === 'attic-insulation')!.condition, 'absent')
for (const season of SEASONS) {
  for (const climate of CLIMATES) {
    assert.notEqual(readingsOf(flatUnknown, season, climate).cavityAir, null, `flat, insulation unknown, ${season}/${climate}: the joist space reads`)
  }
}

const yard = ASSEMBLIES['yard-ground']
const lawnYard = resolveAssembly(yard, { existing: { form: null, basis: 'typical', parts: {
  'native-soil': { material: 'earth', condition: 'retained' },
  'irrigation': { material: 'line-and-heads', condition: 'worn' },
  'base': { material: null, condition: 'absent' },
  'bedding': { material: null, condition: 'absent' },
  'surface': { material: 'lawn', condition: 'worn' },
} }, proposedScopeIds: [], view: 'existing' })
assert.equal(relativeWaterFlow(lawnYard, 'irrigation').boundaries[0], 1, 'a watered lawn draws full demand')
const turfYard = lawnYard.map(part => part.id === 'surface' ? { ...part, material: 'turf', water: { demand: 0 } } : part.id === 'irrigation' ? { ...part, material: null, condition: 'absent' as const, water: null } : part)
assert.equal(relativeWaterFlow(turfYard, 'irrigation').boundaries[0], 0, 'turf with the sprinklers removed draws nothing')

// Rain: a worn covering lets it through to the deck; a new roof sheds all of it.
const rainOn = (home: ExistingConditions, scopeIds: string[]) => relativeWaterFlow(resolveAssembly(roofAttic, { existing: home, proposedScopeIds: scopeIds, view: scopeIds.length ? 'proposed' : 'existing' }), 'rain')
const rainBefore = rainOn(existing, [])
console.log(`rain, existing 1950-1978 shingle: reachesInside ${rainBefore.reachesInside}, soaked ${JSON.stringify(rainBefore.soaked)}`)
assert.ok(rainBefore.reachesInside > 0 && rainBefore.soaked.deck > 0, 'rain finds the worn shingle build and soaks its deck')
for (const [name, home, scope] of [['tear-off', existing, SCOPE_IDS.roofTearOff], ['overlay', existing, SCOPE_IDS.roofOverlay], ['torch-down', flat, SCOPE_IDS.roofTorchDown], ['tile reset', tileHome, SCOPE_IDS.roofTileReset]] as const) {
  const rain = rainOn(home, [scope])
  assert.equal(rain.shed, 1, `${name} sheds all the rain`)
  assert.equal(rain.reachesInside, 0, `${name} keeps the ceiling dry`)
}
const redecked = rainOn(existing, [SCOPE_IDS.roofRedeck])
assert.ok(redecked.reachesInside > 0 && redecked.soaked.deck === undefined, 'a new deck under worn shingles does not rot, and the rain still gets in')

// No proposed build, however partial, lets more rain inside than the home lets in today: every subset of the roof-attic scopes, with and without the cool roof.
const roofAtticScopeIds = Object.entries(SCOPE_INSTALLS).flatMap(([scopeId, entry]) => entry?.assembly === 'roof-attic' ? [scopeId] : [])
const scopeSets = Array.from({ length: 2 ** roofAtticScopeIds.length }, (_, mask) => roofAtticScopeIds.filter((_, bit) => (mask >> bit) & 1))
let rainBuildsChecked = 0
for (const roofType of [...roofTypes, null]) {
  for (const yearBuilt of [...yearBuiltRanges, null]) {
    const home = inferRoof(profile({ roofType, yearBuilt }))
    const today = relativeWaterFlow(resolveAssembly(roofAttic, { existing: home, proposedScopeIds: [], view: 'existing' }), 'rain').reachesInside
    for (const proposedScopeIds of scopeSets) {
      for (const efficiencyUpgrades of [[], ['cool-roof']] as const) {
        const proposed = relativeWaterFlow(resolveAssembly(roofAttic, { existing: home, proposedScopeIds, view: 'proposed', efficiencyUpgrades }), 'rain').reachesInside
        assert.ok(proposed <= today, `${roofType}/${yearBuilt} with ${proposedScopeIds.join(',') || 'nothing'}${efficiencyUpgrades.length ? ' + cool roof' : ''}: rain reaches inside ${proposed}, more than today's ${today}`)
        rainBuildsChecked++
      }
    }
  }
}
console.log(`rain: ${rainBuildsChecked} proposed builds never leak more than today`)

// The readings grid in °F (roof surface / attic air / ceiling surface). Insulation is unknown, so the era decides it.
const degrees = (value: number | null) => value === null ? '-' : value.toFixed(0)
console.log(`${'roof type'.padEnd(10)} ${'era'.padEnd(10)} ${'view'.padEnd(21)} | ${SEASONS.flatMap(season => CLIMATES.map(climate => `${climate} ${season}`.padEnd(14))).join(' | ')}`)
for (const roofType of [...roofTypes, null]) {
  for (const yearBuilt of [...yearBuiltRanges, null]) {
    const home = inferRoof(profile({ roofType, yearBuilt, insulationLevel: null }))
    for (const view of readingViews) {
      const cells = SEASONS.flatMap(season => CLIMATES.map((climate) => {
        const readings = readingsOf(viewParts(home, view), season, climate)
        return `${degrees(readings.outerSurface)}/${degrees(readings.cavityAir)}/${degrees(readings.innerSurface)}`.padEnd(14)
      }))
      console.log(`${String(roofType).padEnd(10)} ${String(yearBuilt).padEnd(10)} ${view.padEnd(21)} | ${cells.join(' | ')}`)
    }
  }
}

// Normal: a mild afternoon, the summer direction at a fraction of the sun and the flow.
const NORMAL_FLOW_SHARE = 0.35
const fullBuild = buildOf({ part: 'covering', material: 'shingle' }, r38, barrier)
for (const climate of CLIMATES) {
  const today = { normal: readingsOf(before, 'normal', climate), summer: readingsOf(before, 'summer', climate) }
  assert.ok(today.normal.outerSurface < today.summer.outerSurface, `normal/${climate}: the roof surface is cooler than summer's`)
  const gap = (weather: 'normal' | 'summer') => readingsOf(before, weather, climate).innerSurface - readingsOf(fullBuild, weather, climate).innerSurface
  assert.ok(gap('normal') > 0 && gap('normal') < gap('summer'), `normal/${climate}: the build still beats today, by less`)
}
const inlandToday = { normal: readingsOf(before, 'normal', 'inland'), summer: readingsOf(before, 'summer', 'inland') }
assert.ok(CLIMATE_PRESETS.inland.normal.setpoint < inlandToday.normal.innerSurface && inlandToday.normal.innerSurface < inlandToday.summer.innerSurface, 'normal: inland ceiling sits between the thermostat and summer\'s')
assert.ok(readingsOf(before, 'normal', 'coastal').innerSurface > CLIMATE_PRESETS.coastal.normal.setpoint, 'normal: coastal sun still pushes heat in')
const normalFlow = relativeHeatFlow(roofAttic, before, 'normal', 'inland')
const summerFlow = relativeHeatFlow(roofAttic, before, 'summer', 'inland')
normalFlow.boundaries.forEach((boundary, index) => {
  assert.ok(Math.abs(boundary - summerFlow.boundaries[index] * NORMAL_FLOW_SHARE) < 1e-9, `normal: ribbon ${index} carries the flow share`)
})
assert.ok(Math.abs(normalFlow.reflected - summerFlow.reflected * NORMAL_FLOW_SHARE) < 1e-9, 'normal: the reflected share carries the flow share')
assert.equal(NORMAL_FLOW_SHARE, HEAT_WEATHER_PROFILES.normal.flow, 'normal: the flow share pinned here is the profile\'s')
assert.equal(seasonOf('normal'), 'summer')
assert.equal(seasonOf('summer'), 'summer')
assert.equal(seasonOf('winter'), 'winter')
assert.equal(seasonOf('rain'), null)
for (const id of ['roof-attic', 'exterior-wall', 'hvac-attic', 'crawl-space'] as const) {
  assert.equal(ASSEMBLIES[id].modes.normal, 'thermal', `${id}: Normal reads as heat`)
}

assert.deepEqual(Object.values(SCOPE_IDS).sort(), Object.keys(SCOPE_INSTALLS).sort(), 'every installed scope has a name, and every name an install')
const roofWork = Object.keys(SCOPE_INSTALLS).filter(id => SCOPE_INSTALLS[id]!.installs.some(install => install.part === 'covering' || install.part === 'deck'))
assert.deepEqual([...new Set(Object.values(SCOPES_BY_EXISTING_ROOF).flat())].sort(), roofWork.sort(), 'R81 lists exactly the covering and deck work')
assert.deepEqual(SCOPES_BY_EXISTING_ROOF, {
  shingle: [SCOPE_IDS.roofOverlay, SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  flat: [SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofRedeck],
  tile: [SCOPE_IDS.roofTileReset, SCOPE_IDS.roofRedeck],
  woodshake: [SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  metal: [],
}, 'R81')
for (const [picks, allowed] of [[[], false], [[SCOPE_IDS.roofOverlay], false], [[SCOPE_IDS.roofTearOff], true], [[SCOPE_IDS.roofTorchDown], true], [[SCOPE_IDS.roofTileReset], true], [[SCOPE_IDS.gutters], false]] as const) {
  assert.equal(redeckAllowed(picks), allowed, `redeck with ${picks.join(',') || 'nothing'}`)
}
assert.equal(roofFormOf(null), null)
for (const roofType of roofTypes) {
  assert.equal(roofFormOf(roofType), roofType === 'flat' ? 'low-slope' : 'pitched', `${roofType}: form`)
  assert.equal(inferRoof(profile({ roofType })).form, roofFormOf(roofType), `${roofType}: the inference uses roofFormOf`)
}

// Home materials: wear, age bands, and the era's first guess.
function facts(property: PropertyProfile, materials: Partial<HomeMaterialFacts> = {}, year = 2026): HomeFacts {
  return {
    property,
    materials: { wear: {}, gutters: null, exteriorPaint: null, ducts: null, crawlInsulation: null, acTons: null, shingleColor: null, paintWear: {}, ...materials },
    year,
  }
}
for (const id of HOME_MATERIAL_IDS) {
  for (const bands of Object.values(HOME_MATERIALS[id].bands)) {
    assert.ok(bands.every((start, i) => i === 0 || start > bands[i - 1]), `${id}: bands rise`)
    for (const wear of wears) {
      const [from, to] = ageBandOf(bands, wear)
      assert.equal(wearForAge(bands, from), wear, `${id} ${wear}: its first year`)
      if (to !== null)
        assert.notEqual(wearForAge(bands, to), wear, `${id} ${wear}: ends before ${to}`)
    }
  }
  assert.ok(HOME_MATERIALS[id].parts.length > 0, `${id} draws at least one part`)
}
assert.equal(wearForAge(HOME_MATERIALS['exterior-paint'].bands.all, 10), 'worn', 'paint at 10 is Worn')
assert.equal(wearForAge(HOME_MATERIALS.roof.bands.shingle, 20), 'failing', 'shingle at 20 is Failing')
assert.equal(homeAge('1950-1978', 2026), 62)
assert.equal(homeAge(null, 2026), 62, 'no era: the fallback era')

const sixties = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: null, insulationLevel: null })))
assert.equal(sixties.windows?.option, 'single')
assert.equal(sixties.windows?.optionBasis, 'era-typical')
assert.equal(sixties.windows?.wear, 'failing', 'era-age windows: 62 years is Failing')
assert.equal(sixties.windows?.wearBasis, 'era-typical')
const confirmed = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'single' })))
assert.equal(confirmed.windows?.wear, sixties.windows?.wear, 'confirming the era guess keeps the era wear')
const replaced = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'double' })))
assert.equal(replaced.windows?.wear, null, 'a material other than the guess: set its condition')
assert.equal(wearInForce(replaced.windows!), 'worn', 'unset counts as Worn')
const rated = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'double' }), { wear: { windows: 'good' } }))
assert.equal(rated.windows?.wear, 'good')
assert.equal(rated.windows?.wearBasis, 'recorded')
const moved = resolveHomeMaterials(facts(profile({ yearBuilt: 'Post-2014', windowsType: 'double', insulationLevel: null }), { wear: { windows: 'good' } }))
assert.equal(moved.windows?.wear, 'good', 'an era change leaves what the rep set')
assert.equal(moved['attic-insulation']?.option, 'r30', 'and refills what the rep left')
for (const roofType of [null, 'shingle'] as const) {
  const recent = resolveHomeMaterials(facts(profile({ yearBuilt: 'Post-2014', roofType })))
  assert.ok(['new', 'good'].includes(recent.roof!.wear!), `Post-2014 roof (${roofType}): New or Good, so no leak`)
}
assert.equal(resolveHomeMaterials(facts(profile({ roofType: 'shingle' }))).roof?.wear, resolveHomeMaterials(facts(profile({ roofType: null }))).roof?.wear, 'setting the roof type never unsets its wear')
assert.equal(resolveHomeMaterials(facts(profile({ roofType: 'flat', insulationLevel: null })))['attic-insulation']?.absent, true, 'no era insulation under a flat roof')
assert.equal(resolveHomeMaterials(facts(profile({ foundationType: 'slab' })))['crawl-insulation'], undefined, 'no crawl space on a slab')
assert.equal(resolveHomeMaterials(facts(profile({ hvacType: 'wall-mounted' }))).ducts, undefined, 'no ducts with a wall unit')
assert.equal(resolveHomeMaterials(facts(profile({ foundationType: 'raised' })))['crawl-insulation']?.absent, true, 'an older raised home: no crawl insulation, nothing to rate')
assert.equal(resolveHomeMaterials(facts(profile({ insulationLevel: 'none' })))['attic-insulation']?.absent, true, 'a recorded none: nothing to rate')
for (const yearBuilt of [...yearBuiltRanges, null]) {
  const unknown = resolveHomeMaterials(facts(profile({ yearBuilt, windowsType: null, insulationLevel: null, roofType: null, hvacType: null })))
  assert.ok(HOME_MATERIAL_IDS.filter(id => id !== 'crawl-insulation').every(id => unknown[id]), `${yearBuilt}: an all-unknown home resolves every material`)
}
const notSure = facts(profile({ yearBuilt: '1950-1978' }), { exteriorPaint: null, ducts: null })
assert.deepEqual(resolveHomeMaterials(notSure)['exterior-paint'], resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978' })))['exterior-paint'], '"Not sure" is the era guess')

// Which installs save energy: the installed material has a rank and the existing one is absent, unranked or lower.
const glazing = ASSEMBLIES.windows.parts.find(part => part.id === 'glazing')!
assert.equal(installKind(glazing, 'single-pane', 'double-pane'), 'saves-energy')
assert.equal(installKind(glazing, 'double-pane', 'double-pane'), 'like-for-like', 'double over double')
const ducts = ASSEMBLIES['hvac-attic'].parts.find(part => part.id === 'duct-runs')!
assert.equal(installKind(ducts, 'original-flex', 'r6-silver-flex'), 'saves-energy')
assert.equal(installKind(ducts, 'r6-silver-flex', 'r8-flex'), 'saves-energy', 'R-6 → R-8 still saves')
assert.equal(installKind(ducts, 'r8-flex', 'r6-silver-flex'), 'like-for-like')
const insulation = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'attic-insulation')!
assert.equal(installKind(insulation, 'batts-r30', 'blown-r38'), 'saves-energy', 'high (R-30) → R-38 saves a little')
// The existing roof is never cool, so a regular covering over any existing roof is like for like and a cool one always saves.
const coveringPart = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'covering')!
for (const roofType of roofTypes) {
  const existingCovering = inferRoofAtticExistingConditions(facts(profile({ roofType })), resolveHomeMaterials(facts(profile({ roofType })))).parts.covering?.material
  assert.ok(existingCovering, `${roofType}: has an existing covering`)
  assert.equal(installKind(coveringPart, existingCovering, 'shingle'), 'like-for-like', `${roofType}: a regular shingle is like for like`)
  assert.equal(installKind(coveringPart, existingCovering, 'cool-shingle'), 'saves-energy', `${roofType}: cool shingles save`)
}
const gutter = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'gutter')!
assert.equal(installKind(gutter, null, 'aluminum'), 'like-for-like', 'gutters carry no energy rank')
const radiantBarrier = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'radiant-barrier')!
assert.equal(installKind(radiantBarrier, null, 'foil'), 'saves-energy')
const airSealing = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'air-sealing')!
assert.equal(installKind(airSealing, null, 'sealed'), 'like-for-like', 'air sealing moves no bill')
assert.deepEqual(combineCuts({ trades: [], addOns: ['radiant-barrier'], addOnTrades: ['attic-and-basement'] }, 'electric', TRADE_BILL_CUTS).parts, [{ source: 'radiant-barrier', percent: 5 }], 'radiant barrier alone: its own add-on')
assert.equal(SCOPE_INSTALLS[SCOPE_IDS.crawlSpaceInsulation]!.trade, 'foundation-and-crawl-space', 'the foundation system owns crawl insulation')
const ductsOnly = combineCuts({ trades: [], addOns: ['ducts'], addOnTrades: ['hvac'] }, 'electric', TRADE_BILL_CUTS)
assert.deepEqual(ductsOnly.parts, [{ source: 'ducts', percent: 5 }], 'ducts alone earn only their +5')
assert.deepEqual(combineCuts({ trades: ['hvac'], addOns: ['ducts'] }, 'gas', TRADE_BILL_CUTS).parts.map(part => part.percent), [20, 5], 'the calculator\'s call is unchanged')
assert.deepEqual(TRADE_BILL_CUTS['foundation-and-crawl-space'], { base: { electric: 2, gas: 5 } })
// R-38 steps up past R-30: 2 points more on both bills, kept apart from the efficiency upgrade that picks it.
const billCuts: TradeBillCuts = TRADE_BILL_CUTS
assert.deepEqual(billCuts['attic-and-basement']?.addOns?.['insulation-step-up'], { electric: 2, gas: 2 }, 'R-38 cuts 2 points more than R-30 on both bills')
assert.equal(BILL_CUT_ADD_ON_LABELS['insulation-step-up'], 'R-38 insulation')
assert.deepEqual(insulation.materials['blown-r38'].stepUp, { from: 'blown-r30', cut: 'insulation-step-up' }, 'blown R-38 steps up from blown R-30')
assert.deepEqual(insulation.materials['batts-r38'].stepUp, { from: 'batts-r30', cut: 'insulation-step-up' }, 'batts R-38 steps up from R-30 batts')
for (const assembly of Object.values(ASSEMBLIES)) {
  for (const part of assembly.parts) {
    for (const [id, material] of Object.entries(part.materials)) {
      if (material.stepUp) {
        const from = part.materials[material.stepUp.from]
        assert.ok(from && from.energyRank !== undefined && material.energyRank !== undefined && from.energyRank < material.energyRank, `${part.id} ${id}: steps up from a lower-ranked material`)
      }
    }
  }
}
// @ts-expect-error a material earns an add-on in place of the base, or steps up past a material, never both
const cutAndStepUp: PartMaterialDefinition = { copy: { label: 'x', detail: 'x' }, cut: 'attic-fan', stepUp: { from: 'blown-r30', cut: 'insulation-step-up' } }
assert.ok(cutAndStepUp)
assert.equal(OWENS_CORNING_SHINGLES.length, 17)
assert.ok(OWENS_CORNING_SHINGLES.every(color => color.agedSri >= 16), 'every colour meets Title 24')
assert.deepEqual(OWENS_CORNING_SHINGLES.filter(color => color.line === 'cool' && color.agedSri >= 20).map(color => color.name).sort(), ['Amber', 'Oyster Shell', 'Shasta White', 'Sierra Gray'])
for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
  assert.ok((ASSEMBLIES[entry!.assembly].trades as readonly string[]).includes(entry!.trade), `${scopeId}: its trade belongs to ${entry!.assembly}`)
}

// Existing parts follow the home's materials and their wear.
const roofParts = (f: HomeFacts) => inferRoofAtticExistingConditions(f, resolveHomeMaterials(f)).parts
const newRoof = roofParts(facts(profile({}), { wear: { roof: 'new' } }))
assert.equal(newRoof.covering.condition, 'retained', 'wear New: kept')
assert.equal(newRoof.covering.wear, 'new')
assert.equal(roofParts(facts(profile({}), { wear: { roof: 'fair' } })).covering.condition, 'worn', 'any other wear: worn')
assert.equal(roofParts(facts(profile({}))).ceiling.condition, 'retained', 'the ceiling never follows the roof')
assert.equal(roofParts(facts(profile({}), { gutters: 'none' })).gutter.condition, 'absent')
for (const roofType of roofTypes) {
  assert.ok(!roofParts(facts(profile({ roofType }))).covering.material?.startsWith('cool-'), `${roofType}: the existing roof is never cool`)
}
assert.equal(roofParts(facts(profile({ roofType: 'flat', insulationLevel: null })))['attic-insulation'].condition, 'absent', 'the low-slope rule is the resolver\'s')
assert.equal(roofParts(facts(profile({ insulationLevel: 'none' })))['attic-insulation'].condition, 'absent', 'none recorded: absent')
const hvacFor = (patch: Partial<PropertyProfile>) => inferHvacAtticExistingConditions(facts(profile(patch)), resolveHomeMaterials(facts(profile(patch))))
assert.equal(hvacFor({ hvacType: 'package-unit' }).form, 'package')
assert.equal(hvacFor({}).form, 'split')
assert.equal(hvacFor({ hvacComponents: 'furnace' }).parts.condenser.condition, 'absent', 'a furnace alone has no condenser')
assert.equal(hvacFor({ yearBuilt: '1950-1978' }).parts['duct-runs'].material, 'original-flex')
const crawl = (f: HomeFacts) => inferCrawlSpaceExistingConditions(f, resolveHomeMaterials(f)).parts['floor-insulation']
assert.equal(crawl(facts(profile({ foundationType: 'raised' }))).condition, 'absent')
assert.equal(crawl(facts(profile({ foundationType: 'raised' }), { crawlInsulation: 'insulated', wear: { 'crawl-insulation': 'good' } })).material, 'batts-r19')
const windowsFor = (patch: Partial<PropertyProfile>) => inferWindowsExistingConditions(facts(profile(patch)), resolveHomeMaterials(facts(profile(patch)))).parts
assert.equal(windowsFor({ windowsType: 'double' }).glazing.material, 'double-pane')
assert.equal(windowsFor({ windowsType: null, yearBuilt: '1950-1978' }).glazing.material, 'single-pane', 'the era guess')
assert.equal(windowsFor({ windowsType: 'single' }).frame.material, 'original-frame')
const wallFor = (f: HomeFacts) => inferExteriorWallExistingConditions(f, resolveHomeMaterials(f))
const repaintWith = (scopeId: ScopeId) => resolveAssembly(ASSEMBLIES['exterior-wall'], { existing: wallFor({ property: profile({}), materials: HOME_MATERIAL_FACTS_UNSET, year: 2026 }), proposedScopeIds: [scopeId], view: 'proposed' }).find(part => part.id === 'paint')!
assert.deepEqual([repaintWith(SCOPE_IDS.waterBasedRepaint).material, repaintWith(SCOPE_IDS.waterBasedRepaint).condition], ['standard', 'installed'], 'the water-based repaint puts on regular paint, new')
assert.equal(repaintWith(SCOPE_IDS.coolLifeRepaint).material, 'cool')
assert.equal(NOT_DRAWN[SCOPE_IDS.waterBasedRepaint], undefined, 'the water-based repaint is drawn')
assert.equal(wallFor(facts(profile({}))).form, 'stucco')
assert.equal(wallFor(facts(profile({}))).parts.paint.material, 'standard')
assert.equal(wallFor(facts(profile({}), { exteriorPaint: 'cool' })).parts.paint.material, 'cool')
assert.equal(wallFor(facts(profile({}))).parts['cavity-insulation'].condition, 'absent')
for (const [id, infer] of [['windows', inferWindowsExistingConditions], ['exterior-wall', inferExteriorWallExistingConditions], ['hvac-attic', inferHvacAtticExistingConditions], ['crawl-space', inferCrawlSpaceExistingConditions]] as const) {
  const noYear = facts(profile({ yearBuilt: null }))
  assert.equal(infer(noYear, resolveHomeMaterials(noYear)).basis, 'typical', `${id}: no year built is typical`)
  const dated = facts(profile({}))
  assert.equal(infer(dated, resolveHomeMaterials(dated)).basis, 'era-typical', `${id}: a guessed material is era-typical`)
}
assert.equal(inferWindowsExistingConditions(facts(profile({ windowsType: 'single' })), resolveHomeMaterials(facts(profile({ windowsType: 'single' })))).basis, 'recorded')
const unsetFacts: HomeFacts = { property: profile({}), materials: HOME_MATERIAL_FACTS_UNSET, year: 2026 }
assert.deepEqual(resolveHomeMaterials(unsetFacts), resolveHomeMaterials(facts(profile({}))), 'unset facts equal an empty record')
const resolvedRoof = resolveAssembly(roofAttic, { existing: inferRoof(profile({})), proposedScopeIds: [], view: 'existing' })
assert.ok(resolvedRoof.find(part => part.id === 'covering')?.wear, 'wear rides through the resolver')
const installedRoof = resolveAssembly(roofAttic, { existing: inferRoof(profile({})), proposedScopeIds: [SCOPE_IDS.roofTearOff], view: 'proposed' })
assert.equal(installedRoof.find(part => part.id === 'covering')?.wear, undefined, 'an installed part has no wear')

// Attic insulation follows what is there: a top off lays its blanket over the old one, a replace takes the old one's place,
// and batts change only how a replace looks.
{
  const insulationOf = (level: PropertyProfile['insulationLevel'], scopeId: ScopeId, efficiencyUpgrades: EfficiencyUpgradeId[], installStyles: InstallStyleId[]) =>
    resolveAssembly(roofAttic, { existing: inferRoof(profile({ insulationLevel: level })), proposedScopeIds: [scopeId], view: 'proposed', efficiencyUpgrades, installStyles }).find(part => part.id === 'attic-insulation')!
  const topOff = insulationOf('r19', SCOPE_IDS.atticInsulationTopOff, [], [])
  assert.deepEqual([topOff.material, topOff.over], ['blown-r30', 'batts-r19'], 'a top off over R-19 is blown R-30 laid over the old batts')
  const replace = insulationOf('r19', SCOPE_IDS.atticInsulationReplacement, [], [])
  assert.deepEqual([replace.material, 'over' in replace], ['blown-r30', false], 'a replace is blown R-30 with nothing under it')
  assert.equal(insulationOf('r19', SCOPE_IDS.atticInsulationReplacement, [], ['batts']).material, 'batts-r30', 'batts lay the replace as R-30 batts')
  assert.equal(insulationOf('r19', SCOPE_IDS.atticInsulationReplacement, ['r38-insulation'], ['batts']).material, 'batts-r38', 'batts with the R-38 step are R-38 batts')
  assert.equal(insulationOf('r19', SCOPE_IDS.atticInsulationReplacement, ['r38-insulation'], []).material, 'blown-r38')
  const toppedBatts = insulationOf('r19', SCOPE_IDS.atticInsulationTopOff, [], ['batts'])
  assert.deepEqual([toppedBatts.material, toppedBatts.over], ['blown-r30', 'batts-r19'], 'a top off is always blown in, whatever the style')
  assert.equal('over' in insulationOf('none', SCOPE_IDS.atticInsulationTopOff, [], []), false, 'a top off over nothing lies over nothing')
  assert.equal(insulationOf('r19', SCOPE_IDS.atticInsulationTopOff, [], []).condition, 'installed')

  const materials = roofAttic.parts.find(part => part.id === 'attic-insulation')!.materials
  const insulates = (id: string) => [materials[id].thermal?.rValue, materials[id].energyRank]
  assert.deepEqual(insulates('blown-r30'), insulates('batts-r30'), 'blown and batts R-30 insulate the same')
  assert.deepEqual(insulates('batts-r38'), insulates('blown-r38'), 'blown and batts R-38 insulate the same')
  assert.deepEqual([materials['blown-r30'].copy.label, materials['batts-r38'].copy.label], ['R-30 blown-in insulation', 'R-38 batts'])
  assert.equal(installedMaterial(SCOPE_IDS.atticInsulationReplacement, [], ['batts']), materials['batts-r30'], 'the installed material reads the style')
  assert.equal(installedMaterial(SCOPE_IDS.atticInsulationReplacement, ['r38-insulation'], ['batts']), materials['batts-r38'])
  assert.equal(installedMaterial(SCOPE_IDS.atticInsulationTopOff, ['r38-insulation'], ['batts']), materials['blown-r38'])

  // The insulation under a flat roof is in closed joists, reached only when the deck comes off.
  assert.equal(atticReachable('pitched', []), true)
  assert.equal(atticReachable('low-slope', []), false)
  assert.equal(atticReachable('low-slope', [SCOPE_IDS.roofTorchDown]), false, 'torch down alone keeps the deck on')
  assert.equal(atticReachable('low-slope', [SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofRedeck]), true)
}

console.log('✓ construction model')
