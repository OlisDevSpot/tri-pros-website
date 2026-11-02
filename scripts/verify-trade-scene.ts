import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { AssemblyKit } from '@/features/trade-scenes/constants/assembly-kits'
import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { ArrowLane, BoxSpec, CeilingOpening, CompleteWallLane, HomeReadings, HomeShell, HouseWall, RoofHeatLane, SceneChange, SceneResolveInputs, SceneSavings, TradeSceneInputs, Vec3, WallHeatLane } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ExistingConditions, HeatWeather, HomeMaterialFacts, PropertyProfile, ResolvedPart, Season, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { BoxGeometry, Color, Euler, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { ASSEMBLY_SCREENS } from '@/features/trade-scenes/constants/assembly-screens'
import { ATTIC_FAN_LOOK } from '@/features/trade-scenes/constants/attic-fan-look'
import { CLIMATE_DEFAULT_BILLS, CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { INFER_EXISTING_CONDITIONS } from '@/features/trade-scenes/constants/existing-conditions'
import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { HOME_ANCHORS, INSIDE_READING_IDS, READING_ANCHORS, READING_CALLOUTS, READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { CEILING_OPENING_LOOK, FOUNDATION, FRONT_STEPS, GABLE_VENT, ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { FADE_SHEET_ORDER, HOME_FADE_TAGS, HOME_FADES_SHOWN, HOME_GHOST_TAG } from '@/features/trade-scenes/constants/home-fades'
import { ATTIC_FAN_SPOT, ATTIC_JOIST_XS, ATTIC_SPANS, BACK_INNER, CEILING_OPENINGS, COVERING_BASE, COVERING_EAVE_X, CRAWL_SKIRT_BOXES, CRAWL_VENT_BOXES, DEEPEST_INSULATION, DOWNSPOUTS, EAVE_RUN, EQUIPMENT, FASCIA_CENTRE, FLOOR_FRAMING, FRONT_CORNERS, FRONT_CRAWL_SKIRT_BOXES, FRONT_CRAWL_VENT_BOXES, FRONT_DOOR, FRONT_OPENINGS, FRONT_WALL, FRONT_WALL_PROUD, GUTTER_BACK, HOME_FLOOR_Y, HOME_FRAMINGS, HOME_GHOST_OPACITY, HOUSE, HOUSE_WALLS, INSULATION_DEPTH, JOIST_DECK_GAP, LOW_SLOPE_DECK_Y, PIERS, RAFTER_PROFILE, RIDGE_Y, ROOF_HALF_LENGTH, SIDE_SKIN_FROM, SLOPE_LENGTH, WALL_TOP_Y, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { HEAT_ARROW_SCALE, HEAT_FLOW_STOPPED, METER_LEVEL, PART_HEAT_EFFECTS, STARTING_HOME_HEAT } from '@/features/trade-scenes/constants/home-heat-figures'
import { ATTIC_FAN_LANE, CEILING_LEAK_LANE, HOME_COMPLETE_ROOF_HEAT_LANES, HOME_COMPLETE_WALL_HEAT_LANES, HOME_COMPLETE_WINDOW_HEAT_LANES, HOME_ROOF_HEAT_LANES, HOME_WALL_HEAT_LANES, HOME_WINDOW_HEAT_LANES, LANE_STANDOFF, OPEN_LANE_REACH } from '@/features/trade-scenes/constants/home-heat-lanes'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { GARAGE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import * as HOME_SCENE_COPY from '@/features/trade-scenes/constants/home-scene-copy'
import { ANCHOR_PIN_LABELS, ASSEMBLY_HEADINGS, ASSEMBLY_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { HOME_SYSTEMS } from '@/features/trade-scenes/constants/home-systems'
import { CRAWL_AIR } from '@/features/trade-scenes/constants/home-temperatures'
import { HOME_PAINT_KEYS } from '@/features/trade-scenes/constants/home-thermal-zones'
import { PAINT_WEAR_SHARE, PAINT_WEAR_START, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { KIT_FLOW } from '@/features/trade-scenes/constants/roof-attic-flows'
import { KIT_PEEL } from '@/features/trade-scenes/constants/roof-attic-kit'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { HOME_VIEWS, SCENE_WEATHERS } from '@/features/trade-scenes/constants/scene-controls'
import { SCOPE_VERBS } from '@/features/trade-scenes/constants/scope-verbs'
import { WEAR_AMOUNT, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { applySceneChange } from '@/features/trade-scenes/lib/apply-scene-change'
import { arrowStations } from '@/features/trade-scenes/lib/arrow-stations'
import { atticFanRuns } from '@/features/trade-scenes/lib/attic-fan-runs'
import { atticInsulationBoxes, atticInsulationTop } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { atticJoistBoxes } from '@/features/trade-scenes/lib/attic-joist-boxes'
import { castResidents } from '@/features/trade-scenes/lib/cast-residents'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { comfortFromReadings } from '@/features/trade-scenes/lib/comfort-from-readings'
import { coveringBaseY } from '@/features/trade-scenes/lib/covering-base-y'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { ductRunPoints } from '@/features/trade-scenes/lib/duct-run-points'
import { ductStrapBoxes } from '@/features/trade-scenes/lib/duct-strap-boxes'
import { ductsHang } from '@/features/trade-scenes/lib/ducts-hang'
import { efficiencyUpgradePatch } from '@/features/trade-scenes/lib/efficiency-upgrade-patch'
import { eraCodeLine } from '@/features/trade-scenes/lib/era-code-line'
import { foamCollarsShown } from '@/features/trade-scenes/lib/foam-collars-shown'
import { FOUNDATION_FRONT_WALL, FOUNDATION_WALLS, RAISED_GROUND_STRETCH } from '@/features/trade-scenes/lib/foundation-walls'
import { framingTowardPart } from '@/features/trade-scenes/lib/framing-toward-part'
import { FRONT_DOOR_BOXES } from '@/features/trade-scenes/lib/front-door-boxes'
import { gableVentBoxes, homeGableVent } from '@/features/trade-scenes/lib/gable-vent-boxes'
import { GARAGE_BOXES } from '@/features/trade-scenes/lib/garage-boxes'
import { bounceArrowLane, heatArrowLane } from '@/features/trade-scenes/lib/heat-arrow-lane'
import { heatLaneFlows } from '@/features/trade-scenes/lib/heat-lane-flows'
import { homeFadeNeeded } from '@/features/trade-scenes/lib/home-fade-needed'
import { homeFloorY } from '@/features/trade-scenes/lib/home-floor-y'
import { homeHeat } from '@/features/trade-scenes/lib/home-heat'
import { coveringStandoff, homeHeatLanes } from '@/features/trade-scenes/lib/home-heat-lanes'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homePaintTemperatures } from '@/features/trade-scenes/lib/home-paint-temperatures'
import { homePanBox } from '@/features/trade-scenes/lib/home-pan-box'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { SHINGLE, TILE } from '@/features/trade-scenes/lib/home-roof-layout'
import { insideHouse } from '@/features/trade-scenes/lib/inside-house'
import { kitBarrierBounceEnd, kitHeatLanes, kitHeatSpans } from '@/features/trade-scenes/lib/kit-heat-lanes'
import { offsetBy, roofAxes } from '@/features/trade-scenes/lib/kit-line-spans'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { lowSlopeRoofBoxes } from '@/features/trade-scenes/lib/low-slope-roof-boxes'
import { existingDuctChoices, hasAcUnit, roofTypeChoices, showsEquipment } from '@/features/trade-scenes/lib/material-option-choices'
import { missingFacts } from '@/features/trade-scenes/lib/missing-facts'
import { doorFramePeeling, fasciaPeeling, wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { piecesInSpan } from '@/features/trade-scenes/lib/pieces-in-span'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { rainRibbonPath } from '@/features/trade-scenes/lib/ribbon-paths'
import { gableCracks, parapetCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { savingsFigures } from '@/features/trade-scenes/lib/savings-figures'
import { sceneBurstKey } from '@/features/trade-scenes/lib/scene-burst-key'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'
import { scopePreviewPatch } from '@/features/trade-scenes/lib/scope-preview-patch'
import { searchSceneChanges } from '@/features/trade-scenes/lib/search-scene-changes'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { fadeBlotches, runoffStreaks, sillDirt, splashBand } from '@/features/trade-scenes/lib/stain-boxes'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { upgradeRowBlockedLine } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { ventPipeStubCylinders } from '@/features/trade-scenes/lib/vent-pipe-stub-cylinders'
import { sillLedgeBox, windowBoxes } from '@/features/trade-scenes/lib/window-boxes'
import { createKitPartPaint, paintKitPart, restoreKitPart } from '@/features/trade-scenes/ui/components/assembly-kits/lib/kit-part-paint'
import { applyGhost } from '@/features/trade-scenes/ui/lib/apply-ghost'
import { applyHomeFloor } from '@/features/trade-scenes/ui/lib/apply-home-floor'
import { STAIN_CELL_U } from '@/features/trade-scenes/ui/lib/create-stain-atlas'
import { createFadeSheets, markFadeSheet, settleFadeSheets } from '@/features/trade-scenes/ui/lib/fade-sheets'
import { paintLook } from '@/features/trade-scenes/ui/lib/paint-look'
import { riseFadeGroup } from '@/features/trade-scenes/ui/lib/rise-fade-group'
import { createThermalPaintSet, paintThermal, restoreThermalPaint } from '@/features/trade-scenes/ui/lib/thermal-paint-set'
import { mergeStainBoxes, tintVertices } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'
import { wallSkinGeometry } from '@/features/trade-scenes/ui/lib/wall-skin-geometry'
import { watchSubtree } from '@/features/trade-scenes/ui/lib/watch-subtree'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { yearBuiltRanges } from '@/shared/constants/enums/customers'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ROOF_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/roof-attic'
import { BILL_CUT_ADD_ON_IDS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import { CLIMATE_PRESETS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'
import { insulationLevels, roofTypes, wears } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIAL_FACTS_UNSET, HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { NOT_DRAWN } from '@/shared/modules/construction/core/constants/scope-not-drawn'
import { TRADE_BILL_CUTS } from '@/shared/modules/construction/core/constants/trade-bill-cuts'
import { combineCuts } from '@/shared/modules/construction/core/lib/combine-cuts'
import { cutFor } from '@/shared/modules/construction/core/lib/cut-for'
import { relativeWaterFlow } from '@/shared/modules/construction/core/lib/relative-water-flow'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'

const VIEWS = ['existing', 'proposed'] as const
const EFFICIENCY_UPGRADE_PICKS: readonly EfficiencyUpgradeId[][] = [[], ['cool-roof']]

const TEAR_OFF = SCOPE_IDS.roofTearOff
const TORCH_DOWN = SCOPE_IDS.roofTorchDown
const ATTIC_REPLACEMENT = SCOPE_IDS.atticInsulationReplacement
const RADIANT_BARRIER = SCOPE_IDS.radiantBarrier
const REDECK = SCOPE_IDS.roofRedeck
const GUTTERS = SCOPE_IDS.gutters
const TILE_RESET = SCOPE_IDS.roofTileReset
const FULL_BUILD = [TEAR_OFF, ATTIC_REPLACEMENT, RADIANT_BARRIER]
const SCOPE_SETS: Record<string, string[]> = {
  'full build': FULL_BUILD,
  'roof only': [TEAR_OFF, GUTTERS],
  'attic only': [ATTIC_REPLACEMENT, RADIANT_BARRIER],
  'fan only': [SCOPE_IDS.atticFan],
  'full build and fan': [...FULL_BUILD, SCOPE_IDS.atticFan],
}

const cuts = resolveTradeBillCuts()
const BILLS: TradeSceneInputs['bills'] = {
  electric: { now: 300, cut: { mode: 'trades', value: null } },
  gas: { now: 120, cut: { mode: 'trades', value: null } },
}

const profile = (facts: Partial<PropertyProfile>): PropertyProfile => ({ ...HOME_SCENE_DEFAULTS.property, ...facts })
const inputs = (overrides: Partial<TradeSceneInputs>): TradeSceneInputs => ({ ...HOME_SCENE_DEFAULTS, ...overrides })
function roofAttic(scene: ReturnType<typeof resolveScene>) {
  const target = scene.assemblies['roof-attic']
  assert.ok(target, 'roof-attic resolves')
  return target
}

// The defaults: an all-unknown profile and household still resolve, with typical wording and a neutral couple.
const unknown = resolveScene(HOME_SCENE_DEFAULTS, cuts)
assert.equal(roofAttic(unknown).basis, 'typical')
assert.equal(unknown.heading.title, 'What is above a typical ceiling')
assert.equal(unknown.heading.eyebrow, 'Roof & attic, x-rayed')
assert.equal(unknown.residents.length, 2, 'an all-null input casts two residents')
assert.ok(unknown.residents.every(resident => resident.role === 'adult' && resident.age === 'middle'), 'a neutral couple')
assert.equal(unknown.savings.cuts.electric.bill, 200, 'no bill typed: the inland default')
assert.equal(HOME_SCENE_DEFAULTS.climate, null, 'coastal or inland is missing until set')
assert.deepEqual(CLIMATE_DEFAULT_BILLS, { inland: { electric: 200, gas: 100 }, coastal: { electric: 155, gas: 110 } })
const billsOf = (climate: Climate | null, electric: number | null) => resolveScene({ ...HOME_SCENE_DEFAULTS, climate, view: 'proposed', bills: { ...HOME_SCENE_DEFAULTS.bills, electric: { ...HOME_SCENE_DEFAULTS.bills.electric, now: electric } } }, cuts).savings.cuts
assert.equal(billsOf(null, null).electric.bill, 200, 'no climate bills as inland')
assert.equal(billsOf(null, null).gas.bill, 100)
assert.equal(billsOf('coastal', null).electric.bill, 155)
assert.equal(billsOf('coastal', null).gas.bill, 110)
assert.equal(billsOf('coastal', 240).electric.bill, 240, 'a typed bill wins')
assert.equal(unknown.meterSpeed, METER_LEVEL.normal, 'the untyped Normal meter reads a mild month')
assert.equal(HOME_SCENE_DEFAULTS.weather, 'normal')
assert.equal(unknown.meterSpeed, 0.4, 'Normal on Today runs the meter at 0.4')

// Criterion 1: readings, paint and savings all come from the one set of resolved parts.
for (const roofType of roofTypes) {
  const property = profile({ yearBuilt: '1950-1978', roofType, insulationLevel: 'low' })
  const facts = { property, materials: HOME_MATERIAL_FACTS_UNSET, year: currentYear() }
  const existing = INFER_EXISTING_CONDITIONS['roof-attic'](facts, resolveHomeMaterials(facts))
  for (const weather of SCENE_WEATHERS) {
    for (const climate of CLIMATES) {
      for (const view of VIEWS) {
        for (const efficiencyUpgrades of EFFICIENCY_UPGRADE_PICKS) {
          for (const [setName, scopeIds] of Object.entries(SCOPE_SETS)) {
            const label = `${roofType} · ${weather} · ${climate} · ${view} · [${efficiencyUpgrades.join(',')}] · ${setName}`
            checkOneScene({ label, property, existing, weather, climate, view, efficiencyUpgrades, scopeIds })
          }
        }
      }
    }
  }
}

function checkOneScene({ label, property, existing, weather, climate, view, efficiencyUpgrades, scopeIds }: {
  label: string
  property: PropertyProfile
  existing: ExistingConditions
  weather: Weather
  climate: (typeof CLIMATES)[number]
  view: TradeSceneInputs['view']
  efficiencyUpgrades: EfficiencyUpgradeId[]
  scopeIds: string[]
}) {
  const scene = resolveScene(inputs({ property, weather, climate, view, efficiencyUpgrades, proposedScopeIds: scopeIds, bills: BILLS }), cuts)
  const target = roofAttic(scene)
  const parts = resolveAssembly(ROOF_ATTIC, { existing, proposedScopeIds: scopeIds, view, efficiencyUpgrades })
  assert.deepEqual(target.parts, parts, `${label}: parts`)
  assert.equal(target.form, existing.form, `${label}: form`)
  assert.equal(target.basis, existing.basis, `${label}: basis`)

  // A bill moves only for an installed part that beats what the home has there: the cool covering, the new insulation, the radiant barrier's add-on.
  const installed = (id: string) => parts.some(part => part.id === id && part.condition === 'installed')
  const covering = parts.find(part => part.id === 'covering')
  const coolCovering = installed('covering') && covering?.material?.startsWith('cool-') === true
  const baseTrades = ROOF_ATTIC.trades.filter(trade => (trade === 'roof-and-gutters' && coolCovering) || (trade === 'attic-and-basement' && installed('attic-insulation')))
  const addOns = ROOF_ATTIC.parts.flatMap((part) => {
    const cut = installed(part.id) ? (part.materials as Record<string, { cut?: 'radiant-barrier' | 'attic-fan' }>)[parts.find(p => p.id === part.id)!.material!]?.cut : undefined
    return cut ? [cut] : []
  })
  const earned = baseTrades.length > 0 || addOns.length > 0
  // Bills are facts: the weather never hides one.
  for (const category of SAVINGS_CATEGORIES) {
    const combined = combineCuts({ trades: baseTrades, addOns, addOnTrades: ['attic-and-basement'] }, category, cuts)
    const cut = earned ? cutFor(BILLS[category], combined.parts, combined.combined) : cutFor(BILLS[category], [], 0)
    assert.deepEqual(scene.savings.cuts[category], cut, `${label}: ${category} cut`)
  }
  // The existing roof is never cool, so only a cool covering earns the roof's cut; it never cuts gas.
  assert.equal(scene.savings.cuts.electric.parts.some(part => part.source === 'roof-and-gutters'), coolCovering, `${label}: the roof's cut only with a cool covering`)
  assert.ok(!scene.savings.cuts.gas.parts.some(part => part.source === 'roof-and-gutters'), `${label}: cool roof never cuts gas`)
  if (weather === 'rain') {
    assert.equal(target.mode, 'water', `${label}: mode`)
    assert.deepEqual(target.water, relativeWaterFlow(parts, 'rain'), `${label}: water`)
    assert.equal(scene.heat, null, `${label}: no heat in rain`)
    assert.equal(scene.comfort, null, `${label}: no comfort in rain`)
    assert.equal(scene.equipmentLoad, 0, `${label}: equipment rests in rain`)
    assert.equal(scene.meterSpeed, 0, `${label}: meter rests in rain`)
    return
  }

  const heat = homeHeat(climate, weather, { parts: Object.values(scene.assemblies).flatMap(assembly => assembly.parts), form: homeRoofForm(target.form) })
  assert.equal(target.mode, 'thermal', `${label}: mode`)
  assert.equal(target.water, null, `${label}: no water in ${weather}`)
  assert.deepEqual(scene.heat, heat, `${label}: heat`)
  assert.equal(scene.comfort, comfortFromReadings(heat.readings, CLIMATE_PRESETS[climate][weather].setpoint), `${label}: comfort`)
  assert.equal(scene.equipmentLoad, heat.load, `${label}: equipment load`)
  assert.equal(scene.meterSpeed, METER_LEVEL[weather] * (1 - scene.savings.cuts.electric.combined), `${label}: the meter follows the weather's level and the electric cut`)

  if (view === 'existing') {
    assert.deepEqual(scene.savings.cuts.electric.parts, [], `${label}: today saves nothing`)
    assert.equal(scene.meterSpeed, METER_LEVEL[weather], `${label}: today the meter runs the weather's whole level`)
  }
}

// The pinned savings: a pitched re-roof with cool shingles in summer cuts the attic, the cool roof and the radiant barrier; a torch-down on a pitched home lands nothing.
const coolSummer = resolveScene(inputs({ property: profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel: 'low' }), view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
assert.deepEqual(coolSummer.savings.cuts.electric.parts.map(part => part.source), ['roof-and-gutters', 'attic-and-basement', 'radiant-barrier'])
const torchDownOnPitched = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TORCH_DOWN], efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
assert.equal(roofAttic(torchDownOnPitched).parts.find(part => part.id === 'covering')?.condition, 'worn', 'a membrane cannot go on a pitched roof')
assert.deepEqual(torchDownOnPitched.savings.cuts.electric.parts, [], 'so the roof trade saves nothing')
assert.deepEqual(torchDownOnPitched.savings.repairsByTrade, {}, 'and has no repairs to avoid')

// The cool roof counts only when its covering is drawn: these land roof work but leave the covering as it is.
const noCoolCovering: [string, PropertyProfile['roofType'], string[]][] = [
  ['redeck', 'shingle', [REDECK]],
  ['gutters', 'shingle', [GUTTERS]],
  ['tile reset', 'tile', [TILE_RESET]],
  ['flat + tear-off', 'flat', [TEAR_OFF]],
]
for (const [name, roofType, proposedScopeIds] of noCoolCovering) {
  const scene = resolveScene(inputs({ property: profile({ roofType }), view: 'proposed', proposedScopeIds, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
  assert.ok(scene.savings.repairsByTrade['roof-and-gutters'], `${name}: the roof trade lands`)
  assert.ok(!scene.savings.cuts.electric.parts.some(part => part.source === 'roof-and-gutters'), `${name}: no roof part without a cool covering`)
}
const coolTearOff = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
assert.deepEqual(coolTearOff.savings.cuts.electric.parts, [{ source: 'roof-and-gutters', percent: 8 }], 'a shingle tear-off draws cool shingles, so the roof\'s cut counts')

// A typed cut applies to the proposed build, never to today's figures.
const typedBills: TradeSceneInputs['bills'] = { ...BILLS, electric: { now: 300, cut: { mode: 'percent', value: 30 } } }
const typedToday = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'existing', proposedScopeIds: [TEAR_OFF], bills: typedBills }), cuts)
assert.equal(typedToday.savings.cuts.electric.after, typedToday.savings.cuts.electric.bill, 'today keeps the whole bill')
assert.equal(typedToday.meterSpeed, METER_LEVEL.normal, 'today the meter runs the whole level')
const typedProposed = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: typedBills }), cuts)
assert.equal(typedProposed.savings.cuts.electric.after, 210, 'the proposed build honours the typed cut, as the ROI calculator does')
assert.equal(typedProposed.meterSpeed, 0.4 * 0.7)
for (const [weather, level] of [['summer', 1], ['winter', 0.5]] as const) {
  const todayScene = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), weather, view: 'existing', proposedScopeIds: [TEAR_OFF], bills: typedBills }), cuts)
  const buildScene = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), weather, view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: typedBills }), cuts)
  assert.equal(todayScene.meterSpeed, level, `${weather}: today's meter`)
  assert.equal(buildScene.meterSpeed, level * 0.7, `${weather}: the build's meter`)
}
const typedAmountBills: TradeSceneInputs['bills'] = { ...BILLS, electric: { now: 300, cut: { mode: 'amount', value: 90 } } }
const amountToday = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), weather: 'winter', view: 'existing', proposedScopeIds: [TEAR_OFF], bills: typedAmountBills }), cuts)
const amountBuild = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), weather: 'winter', view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: typedAmountBills }), cuts)
assert.equal(amountToday.meterSpeed, 0.5, 'a typed $ cut leaves today alone')
assert.equal(amountBuild.meterSpeed, 0.5 * 0.7, 'a typed $90 cut on $300 is 30%')

// Repairs: every material a landed part draws, at its wear (a Worn roof is the working number), unless overridden; monthly in whole dollars.
const wornRoof = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } } } as const
const repairs = resolveScene(inputs({ ...wornRoof, view: 'proposed', proposedScopeIds: [TEAR_OFF, ATTIC_REPLACEMENT] }), cuts).savings
assert.deepEqual(repairs.repairsByTrade, { 'roof-and-gutters': { value: 400, source: 'working' } }, 'insulation carries no repairs')
assert.equal(repairs.repairsMonthly, 33)
const overridden = resolveScene(inputs({ ...wornRoof, view: 'proposed', proposedScopeIds: [TEAR_OFF], repairsOverrides: { 'roof-and-gutters': 600 } }), cuts).savings
assert.deepEqual(overridden.repairsByTrade, { 'roof-and-gutters': { value: 600, source: 'input' } })
assert.equal(overridden.repairsMonthly, 50)
assert.equal(resolveScene(inputs({ ...wornRoof, view: 'proposed', proposedScopeIds: [TEAR_OFF], weather: 'rain' }), cuts).savings.repairsMonthly, 33, 'repairs do not depend on the weather')

// Savings figures: a bill with no cut, or no typed bill, shows nothing rather than $0.
const billCut = (bill: number, after: number): SceneSavings['cuts']['electric'] => ({ bill, parts: [], combined: bill === 0 ? 0 : 1 - after / bill, after, typed: false })
const landedRepairs: SceneSavings['repairsByTrade'] = { 'roof-and-gutters': { value: 400, source: 'working' } }
const oneBill = savingsFigures({ cuts: { electric: billCut(300, 210), gas: billCut(0, 0) }, repairsMonthly: 33, repairsByTrade: landedRepairs })
assert.deepEqual(oneBill, { bills: { electric: 90, gas: null }, repairs: 33, total: 123 }, 'one bill typed, the other empty')
const electricOnly = savingsFigures({ cuts: { electric: billCut(300, 210), gas: billCut(0, 0) }, repairsMonthly: 0, repairsByTrade: landedRepairs })
assert.equal(electricOnly.total, null, 'a single figure has nothing to total')
const nothingLanded = savingsFigures({ cuts: { electric: billCut(300, 300), gas: billCut(120, 120) }, repairsMonthly: 0, repairsByTrade: {} })
assert.deepEqual(nothingLanded, { bills: { electric: null, gas: null }, repairs: null, total: null }, 'nothing landed')
const noGasCut = savingsFigures({ cuts: { electric: billCut(300, 210), gas: billCut(120, 120) }, repairsMonthly: 33, repairsByTrade: landedRepairs })
assert.equal(noGasCut.bills.gas, null, 'a gas bill with no cut shows no figure')
const bothBills = savingsFigures({ cuts: { electric: billCut(300, 210), gas: billCut(120, 100) }, repairsMonthly: 33, repairsByTrade: landedRepairs })
assert.equal(bothBills.total, 90 + 20 + 33, 'together sums the shown figures')

// Criterion 3: the dollars the scene shows a homeowner equal the Remodel ROI calculator's for the same bill and picks.
const roiConfig = resolveRemodelRoiConfig()
const roiPicks = createTradePicks()
function roiCut(category: 'electric' | 'gas', bill: TradeSceneInputs['bills']['electric'], picks: (form: RemodelRoiFormValues) => void) {
  const form = createRemodelRoiDefaults(roiConfig)
  form.bills[category] = bill
  picks(form)
  return projectRemodelRoi(form, roiConfig).cuts[category]
}
const roiCases: { name: string, category: 'electric' | 'gas', weather: Weather, scopeIds: string[], efficiencyUpgrades: EfficiencyUpgradeId[], picks: (form: RemodelRoiFormValues) => void }[] = [
  { name: 'summer electric, tear-off + cool roof', category: 'electric', weather: 'summer', scopeIds: [TEAR_OFF], efficiencyUpgrades: ['cool-roof'], picks: (form) => { form.trades['roof-and-gutters'] = roiPicks['roof-and-gutters'] } },
  { name: 'winter gas, attic insulation', category: 'gas', weather: 'winter', scopeIds: [ATTIC_REPLACEMENT], efficiencyUpgrades: [], picks: (form) => { form.trades['attic-and-basement'] = roiPicks['attic-and-basement'] } },
]
for (const { name, category, weather, scopeIds, efficiencyUpgrades, picks } of roiCases) {
  const now = category === 'electric' ? 300 : 120
  for (const cut of [{ mode: 'trades', value: null }, { mode: 'percent', value: 30 }, { mode: 'amount', value: 25 }] as const) {
    const bill = { now, cut }
    const scene = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', weather, proposedScopeIds: scopeIds, efficiencyUpgrades, bills: { ...BILLS, [category]: bill } }), cuts).savings
    const roi = roiCut(category, bill, picks)
    const sceneCut = scene.cuts[category]
    assert.ok(roi.combined > 0, `${name} (${cut.mode}): the ROI cuts this bill, so the match is not vacuous`)
    assert.equal(sceneCut.combined, roi.combined, `${name} (${cut.mode}): combined equals the ROI's`)
    assert.equal(sceneCut.after, roi.after, `${name} (${cut.mode}): after equals the ROI's`)
    assert.deepEqual(sceneCut.parts, roi.parts, `${name} (${cut.mode}): the same parts`)
  }
}

// Criterion 2: "your" only over a recorded basis, across every roof type × era × insulation; the copy never mentions solar.
for (const roofType of [...roofTypes, null]) {
  for (const yearBuilt of [...yearBuiltRanges, null]) {
    for (const insulationLevel of [...insulationLevels, null]) {
      for (const view of VIEWS) {
        for (const weather of SCENE_WEATHERS) {
          const scene = resolveScene(inputs({ property: profile({ roofType, yearBuilt, insulationLevel }), view, weather }), cuts)
          const { basis } = roofAttic(scene)
          const { eyebrow, title, lead } = scene.heading
          const label = `${roofType} · ${yearBuilt} · ${insulationLevel} · ${view} · ${weather}`
          assert.equal(/\byour\b/i.test(title), basis === 'recorded', `${label}: "your" in the title only when recorded (${basis}: ${title})`)
          assert.ok(!/\byour\b/i.test(eyebrow) && !/\byour\b/i.test(lead), `${label}: no "your" outside the title`)
          assert.ok(![eyebrow, title, lead].some(line => /solar/i.test(line)), `${label}: never solar`)
          assert.ok(title.length > 0 && lead.length > 0, `${label}: heading filled`)
          if (basis === 'era-typical') {
            assert.ok(title.startsWith('What homes built ') && title.endsWith(' usually hide'), `${label}: era wording (${title})`)
          }
        }
      }
    }
  }
}

// Comfort: the gap between the ceiling surface and the setpoint, either way.
const readings = (ceiling: number): HomeReadings => ({ 'roof': 0, 'attic': 0, ceiling, 'exterior-wall': 0, 'window': 0 })
assert.equal(comfortFromReadings(readings(80.2), 76), 'strained', '4.2 °F over is strained')
assert.equal(comfortFromReadings(readings(65.8), 70), 'strained', '4.2 °F under is strained')
assert.equal(comfortFromReadings(readings(79.5), 76), 'fair')
assert.equal(comfortFromReadings(readings(78.8), 76), 'comfortable', '2.8 °F is comfortable')
assert.equal(comfortFromReadings(readings(68.4), 70), 'comfortable')

const shingleR11 = profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel: 'low' })
const strained = resolveScene(inputs({ property: shingleR11, weather: 'summer', climate: 'inland', view: 'existing' }), cuts)
assert.equal(strained.comfort, 'strained', `R-11 inland summer today (ceiling ${strained.heat?.readings.ceiling})`)
const comfortable = resolveScene(inputs({ property: shingleR11, weather: 'summer', climate: 'inland', view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'] }), cuts)
assert.equal(comfortable.comfort, 'comfortable', `full build with cool roof inland summer (ceiling ${comfortable.heat?.readings.ceiling})`)
console.log(`  comfort gaps: today ${(strained.heat!.readings.ceiling - 76).toFixed(2)} °F, full build ${(comfortable.heat!.readings.ceiling - 76).toFixed(2)} °F`)

// Rain: worn layers let water through today; a re-roof stops it.
const rainToday = resolveScene(inputs({ property: shingleR11, weather: 'rain', view: 'existing' }), cuts)
assert.ok(rainToday.leak.reachesInside > 0, 'today the rain reaches inside')
assert.equal(rainToday.savings.cuts.electric.bill, 200, 'rain hides no bill: the inland default shows')
const rainWater = roofAttic(rainToday).water!
assert.ok(rainToday.leak.soakedPartIds.length > 0, 'worn parts soak')
assert.deepEqual(rainToday.leak.soakedPartIds, Object.keys(rainWater.soaked).filter(id => rainWater.soaked[id] > 0), 'only parts that actually soak')
const rainReroof = resolveScene(inputs({ property: shingleR11, weather: 'rain', view: 'proposed', proposedScopeIds: [TEAR_OFF] }), cuts)
assert.equal(rainReroof.leak.reachesInside, 0, 'a re-roof keeps the rain out')
assert.deepEqual(rainReroof.leak.soakedPartIds, [], 'zero-valued soaks are not listed')
assert.equal(resolveScene(inputs({ property: shingleR11, weather: 'summer' }), cuts).leak.reachesInside, 0, 'no leak outside rain')

// Normal: a mild afternoon the scene opens on.
assert.equal(HOME_SCENE_DEFAULTS.weather, 'normal', 'the scene opens in Normal')
assert.equal(SCENE_WEATHERS[0], 'normal')
const sceneIn = (weather: Weather, patch: Partial<TradeSceneInputs> = {}) => resolveScene(inputs({ property: shingleR11, weather, ...patch }), cuts)
const normalToday = sceneIn('normal')
assert.ok(normalToday.heat !== null && roofAttic(normalToday).mode === 'thermal', 'Normal draws readings, thermal mode and heat')
assert.ok(normalToday.equipmentLoad < sceneIn('summer').equipmentLoad, 'normal equipment load is below summer\'s')
const ceilingGap = (weather: Weather) => sceneIn(weather).heat!.readings.ceiling - sceneIn(weather, { view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'] }).heat!.readings.ceiling
assert.ok(ceilingGap('normal') < ceilingGap('summer'), 'today vs build ceiling gap: normal < summer')
const noNormalKit: Partial<Record<AssemblyId, AssemblyKit>> = { 'roof-attic': { anchor: 'roof', weathers: ['summer', 'winter', 'rain'] } }
const noNormal = resolveScene(inputs({ property: shingleR11, weather: 'normal' }), cuts, noNormalKit)
assert.equal(roofAttic(noNormal).mode, null, 'a kit without Normal has no close-up mode')
assert.ok(noNormal.heat !== null, 'the home still reads Normal')
for (const view of VIEWS) {
  for (const weather of SCENE_WEATHERS) {
    assert.ok(sceneIn(weather, { view }).heading.lead.length > 0, `${view} · ${weather}: heading lead`)
  }
}

// Cool roof off: the covering stays standard and the roof cuts nothing.
const coolOff = resolveScene(inputs({ property: shingleR11, weather: 'summer', view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: [], bills: BILLS }), cuts)
assert.ok(!coolOff.savings.cuts.electric.parts.some(part => part.source === 'roof-and-gutters'), 'no roof part in the cut')
assert.equal(roofAttic(coolOff).parts.find(part => part.id === 'covering')?.material, 'shingle')

const YEAR = 2026
const at = (patch: Partial<TradeSceneInputs>) => resolveScene(inputs(patch), cuts, ASSEMBLY_KITS, YEAR)
const allHome = at({ property: profile({ foundationType: 'raised', hvacType: 'central' }) })
assert.deepEqual(Object.keys(allHome.assemblies).sort(), ['crawl-space', 'exterior-wall', 'hvac-attic', 'roof-attic', 'windows'], 'every assembly that applies, never the yard')
assert.equal(at({ property: profile({ hvacType: 'wall-mounted', foundationType: 'slab' }) }).assemblies['hvac-attic'], undefined)
const recentRain = at({ property: profile({ yearBuilt: 'Post-2014' }), weather: 'rain' })
assert.equal(recentRain.leak.reachesInside, 0, 'a Post-2014 roof no longer leaks')
assert.ok(at({ property: profile({ yearBuilt: '1950-1978' }), weather: 'rain' }).leak.reachesInside > 0, 'an era-worn roof still does')
const fairRoof: Partial<TradeSceneInputs> = { property: profile({ yearBuilt: '1950-1978' }), homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'fair' } }, weather: 'rain' }
assert.equal(at(fairRoof).leak.reachesInside, 0, 'a Fair roof keeps the rain out')
assert.equal(at({ ...fairRoof, zoom: 'roof-attic' }).assemblies['roof-attic']?.water?.reachesInside ?? 0, 0, 'up close, a Fair roof keeps the rain out too')
// A bill moves only for a part that beats what the home has; upkeep follows each material's wear.
const sixtiesSingle = profile({ yearBuilt: '1950-1978', windowsType: 'single', roofType: 'shingle' })
const doubleOverSingle = at({ property: sixtiesSingle, view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement], bills: BILLS })
assert.ok(doubleOverSingle.savings.cuts.electric.combined > 0, 'double over single saves energy')
const doubleOverDouble = at({ property: { ...sixtiesSingle, windowsType: 'double' }, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'fair' } }, view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement, SCOPE_IDS.gutters], bills: { ...BILLS, electric: { now: 200, cut: { mode: 'percent', value: 30 } } } })
assert.equal(doubleOverDouble.savings.cuts.electric.combined, 0, 'like for like moves no bill, even with a typed cut')
assert.equal(doubleOverDouble.savings.repairsByTrade['windows-and-doors']?.value, Math.round(200 * 0.7), 'like for like credits repairs at the existing wear')
const failingRoof = at({ property: sixtiesSingle, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'failing' } }, view: 'proposed', proposedScopeIds: [SCOPE_IDS.roofTearOff], bills: BILLS })
assert.equal(failingRoof.savings.repairsByTrade['roof-and-gutters']?.value, 600, 'a Failing roof: 1.5 × 400')
const ductsOnlyScene = at({ property: profile({ yearBuilt: '1950-1978', hvacType: 'central' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.airDuctsReplacement], bills: BILLS })
assert.deepEqual(ductsOnlyScene.savings.cuts.electric.parts, [{ source: 'ducts', percent: 5 }], 'ducts alone: +5 only')
assert.equal(ductsOnlyScene.savings.repairsByTrade.hvac, undefined, 'ducts carry no repairs')
const systemAndDucts = at({ property: profile({ yearBuilt: '1950-1978', hvacType: 'central' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.splitSystemReplacement, SCOPE_IDS.airDuctsReplacement], bills: BILLS })
assert.deepEqual(systemAndDucts.savings.cuts.gas.parts.map(part => part.percent), [20, 5], 'the system and the ducts: 25 / 20 and +5 / +5')
const regularTearOff = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.roofTearOff], efficiencyUpgrades: [], bills: BILLS })
assert.equal(regularTearOff.savings.cuts.electric.combined, 0, 'cool off: a regular shingle over the existing roof is like for like')
assert.ok((regularTearOff.savings.repairsByTrade['roof-and-gutters']?.value ?? 0) > 0, 'and its repairs are still credited')
const woodShakeTearOff = at({ property: profile({ roofType: 'woodshake' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.roofTearOff], efficiencyUpgrades: [], bills: BILLS })
assert.equal(woodShakeTearOff.savings.cuts.electric.combined, 0, 'a regular shingle over wood shake is like for like')
assert.ok((woodShakeTearOff.savings.repairsByTrade['roof-and-gutters']?.value ?? 0) > 0, 'and its repairs are still credited')
const barrierOnly = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.radiantBarrier], bills: BILLS })
assert.deepEqual(barrierOnly.savings.cuts.electric.parts, [{ source: 'radiant-barrier', percent: 5 }], 'radiant barrier alone: its add-on, not the insulation base')
const fanOnly = resolveScene(inputs({ property: shingleR11, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.atticFan], bills: BILLS }), cuts)
assert.deepEqual(fanOnly.savings.cuts.electric.parts, [{ source: 'attic-fan', percent: 4 }], 'attic fan alone: electric 4')
assert.deepEqual(fanOnly.savings.cuts.gas.parts, [], 'attic fan cuts no gas')
const fanToday = resolveScene(inputs({ property: shingleR11, weather: 'summer', bills: BILLS }), cuts)
assert.equal(roofAttic(fanToday).parts.find(part => part.id === 'attic-fan')?.condition, 'absent', 'the fan starts absent')
assert.equal(NOT_DRAWN[SCOPE_IDS.atticFan], undefined, 'the attic fan is drawn')
const rows = repairsRows(sixtiesSingle, resolveHomeMaterials({ property: sixtiesSingle, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } }, year: YEAR }))
assert.equal(rows.find(row => row.material === 'roof')?.note, 'Shingle · Worn')
assert.equal(rows.find(row => row.material === 'exterior-paint')?.note?.startsWith('Water-based paint · '), true, 'paint has a note now')
const shallowEqual = (a: object, b: object) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => Object.is(value, (b as Record<string, unknown>)[key]))
const select = (patch: Partial<HomeMaterialFacts>) => selectResolveInputs({ ...HOME_SCENE_DEFAULTS, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, ...patch } })
assert.ok(shallowEqual(select({ acTons: '3' }), select({ acTons: '5', shingleColor: 'oyster-shell', paintWear: { stains: 'heavy' } })), 'the AC size, the shingle colour and the paint wear never re-resolve')
assert.ok(!shallowEqual(select({ wear: { roof: 'good' } }), select({ wear: { roof: 'worn' } })), 'a wear change does')
type DrawingOnlyKey = 'acTons' | 'shingleColor' | 'paintWear'
// One property per key, each `never` when the resolver's inputs carry it, so a key left in fails the assignment.
const drawingOnly: { [K in DrawingOnlyKey]: K extends keyof SceneResolveInputs['homeMaterials'] ? never : true } = { acTons: true, shingleColor: true, paintWear: true }
assert.ok(Object.values(drawingOnly).every(Boolean))
const cameraFocusIsDrawingOnly: 'cameraFocus' extends keyof SceneResolveInputs ? never : true = true
assert.ok(cameraFocusIsDrawingOnly)
const sheetMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
sheetMesh.renderOrder = 1
const sheets = createFadeSheets()
markFadeSheet(sheets, sheetMesh, false)
settleFadeSheets(sheets)
assert.equal(sheetMesh.renderOrder, FADE_SHEET_ORDER.color + 1, 'a mesh\'s own order rides on top of the sheet order, so a stain draws after its wall mid-fade')
settleFadeSheets(sheets)
assert.equal(sheetMesh.renderOrder, 1, 'a mesh that leaves the fade gets its own order back')
const heatAt = (wear: Wear) => at({ homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': wear, 'attic-insulation': wear, 'windows': wear, 'exterior-paint': wear, 'ducts': wear } } }).heat
for (const wear of wears) {
  assert.deepEqual(heatAt(wear), heatAt('worn'), `${wear}: wear never changes a heat figure`)
}
assert.deepEqual(HOME_SCENE_DEFAULTS.efficiencyUpgrades, ['cool-roof'], 'every roof pick starts cool')
assert.deepEqual(TRADE_BILL_CUTS['roof-and-gutters'], { base: { electric: 8 } }, 'the cool roof is the roof\'s own cut')
assert.ok(!(BILL_CUT_ADD_ON_IDS as readonly string[]).includes('cool-roof'), 'cool roof is not an add-on')
const coolOn = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: BILLS })
assert.deepEqual(coolOn.savings.cuts.electric.parts, [{ source: 'roof-and-gutters', percent: 8 }])
const regularShingle = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: [], bills: BILLS })
assert.equal(regularShingle.savings.cuts.electric.combined, 0, 'a regular shingle moves no bill')
const typedRegular = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: [], bills: { ...BILLS, electric: { now: 300, cut: { mode: 'percent', value: 20 } } } })
assert.equal(typedRegular.savings.cuts.electric.combined, 0, 'a typed cut does not move the bill of a regular shingle either')
assert.ok(typedRegular.savings.repairsByTrade['roof-and-gutters'], 'and the roof still earns its repairs credit')
assert.deepEqual(efficiencyUpgradePatch({ efficiencyUpgrades: ['cool-roof'] }, 'cool-roof', false).efficiencyUpgrades, [])
assert.deepEqual(efficiencyUpgradePatch({ efficiencyUpgrades: [] }, 'cool-roof', true).efficiencyUpgrades, ['cool-roof'])
assert.ok(offersEfficiencyUpgrade([TORCH_DOWN], 'cool-roof') && offersEfficiencyUpgrade([TEAR_OFF], 'cool-roof') && offersEfficiencyUpgrade([SCOPE_IDS.roofOverlay], 'cool-roof'), 'the chip shows on shingle and torch down')
assert.ok(!offersEfficiencyUpgrade([SCOPE_IDS.roofTileReset], 'cool-roof'), 'a tile reset has no cool version')

// Casting.
const cast = (type: TradeSceneInputs['household']['type'], ageGroup: TradeSceneInputs['household']['ageGroup']) => castResidents({ type, ageGroup })
const summary = (residents: ReturnType<typeof castResidents>) => residents.map(resident => `${resident.role}:${resident.age}`).sort()
assert.deepEqual(summary(cast(null, null)), ['adult:middle', 'adult:middle'])
assert.deepEqual(summary(cast('Single man', '25-45')), ['adult:young'])
assert.deepEqual(summary(cast('Single woman', '75-or-older')), ['adult:senior'])
assert.deepEqual(summary(cast('Couple', '45-65')), ['adult:middle', 'adult:middle'])
const familySenior = cast('Family', '65-75')
assert.equal(familySenior.filter(resident => resident.role === 'adult' && resident.age === 'senior').length, 2, 'family/senior: two senior adults')
assert.equal(familySenior.filter(resident => resident.role === 'child').length, 2, 'family/senior: two children')
assert.equal(familySenior.length, 4)
const relativesSenior = cast('Relatives', '75-or-older')
assert.equal(relativesSenior.filter(resident => resident.age === 'middle').length, 1, 'relatives/senior: exactly one middle')
assert.equal(relativesSenior.length, 3)
assert.deepEqual(summary(cast('Relatives', 'under-25')), ['adult:senior', 'adult:young', 'adult:young'])
for (const residents of [familySenior, relativesSenior, cast(null, null)]) {
  assert.equal(new Set(residents.map(resident => resident.id)).size, residents.length, 'resident ids are unique')
}
const figures = (residents: ReturnType<typeof castResidents>) => residents.map(resident => resident.figure)
assert.deepEqual(figures(cast('Single woman', null)), ['woman'], 'a single woman is played by the woman figure')
assert.deepEqual(figures(cast('Single man', null)), ['man'])
assert.deepEqual(figures(cast(null, null)), ['man', 'woman'], 'the neutral couple is one of each')
assert.deepEqual(figures(cast('Family', null)), ['man', 'woman', 'man', 'woman'])

// A weather the kit does not draw: the assembly still resolves, with no mode and no flow.
const noRainKit: Partial<Record<AssemblyId, AssemblyKit>> = { 'roof-attic': { anchor: 'roof', weathers: ['summer', 'winter'] } }
const unsupported = roofAttic(resolveScene(inputs({ property: shingleR11, weather: 'rain' }), cuts, noRainKit))
assert.equal(unsupported.mode, null, 'a kit without rain has no mode in rain')
assert.equal(unsupported.water, null)
const noSummerKit: Partial<Record<AssemblyId, AssemblyKit>> = { 'roof-attic': { anchor: 'roof', weathers: ['winter', 'rain'] } }
const noSummer = resolveScene(inputs({ property: shingleR11, weather: 'summer' }), cuts, noSummerKit)
assert.equal(roofAttic(noSummer).mode, null, 'a kit without summer has no close-up mode in summer')
assert.equal(noSummer.comfort, 'strained', 'the home still reads the weather')
assert.ok(noSummer.heat !== null)
assert.equal(roofAttic(resolveScene(inputs({ property: shingleR11, weather: 'rain' }), cuts)).mode, 'water', 'the registered kit draws rain')

// The assembly kit's flows: the ribbons the rep points at must tell the same story as the model.
const flatR11 = profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: 'low' })
for (const [label, property, roofScope] of [['gable', shingleR11, TEAR_OFF], ['flat', flatR11, TORCH_DOWN]] as const) {
  const kitFlows = (weather: Weather, view: 'existing' | 'proposed', scopeIds: string[], efficiencyUpgrades: EfficiencyUpgradeId[], peel = 1) => {
    const target = roofAttic(resolveScene(inputs({ property, weather, view, proposedScopeIds: scopeIds, efficiencyUpgrades }), cuts))
    return { target, form: homeRoofForm(target.form), peel }
  }
  const rain = (view: 'existing' | 'proposed', scopeIds: string[]) => {
    const { target, form, peel } = kitFlows('rain', view, scopeIds, [])
    assert.ok(target.water, `${label} rain: water`)
    const path = rainRibbonPath(form, target.parts, target.water, peel)
    assert.ok(path, `${label} rain: path`)
    return path
  }
  const leak = rain('existing', [])
  assert.ok(leak.drip, `${label}: today's rain reaches the ceiling and drips`)
  assert.ok((leak.path.points.at(-1)?.[1] ?? 1) < 0, `${label}: today's rain ends under the ceiling`)
  const shed = rain('proposed', [roofScope])
  assert.equal(shed.drip, null, `${label}: a new roof does not drip`)
  assert.equal(shed.path.points.at(-1)?.[2], KIT_FLOW.gutterZ, `${label}: a new roof's rain ends in the gutter`)
}

// The heat figures: one hand-tuned table, composed from what the home has.
function near(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`)
}
const HEAT_WEATHERS: readonly HeatWeather[] = ['normal', 'summer', 'winter']
const shellOf = (scene: ReturnType<typeof resolveScene>): HomeShell => ({ parts: Object.values(scene.assemblies).flatMap(assembly => assembly.parts), form: homeRoofForm(roofAttic(scene).form) })
const todayIn = (climate: Climate, weather: HeatWeather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate }), cuts)))
const buildIn = (climate: Climate, weather: HeatWeather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate, view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'] }), cuts)))

// The starting home is today's default home: no effect applies to it.
for (const climate of CLIMATES) {
  for (const weather of HEAT_WEATHERS) {
    assert.deepEqual(todayIn(climate, weather).readings, STARTING_HOME_HEAT[climate][weather].readings, `${climate} ${weather}: today's readings are the starting home's`)
  }
}

near(buildIn('inland', 'summer').readings.roof, 153.4, 2, 'inland summer build roof')
near(buildIn('inland', 'summer').readings.attic, 120.6, 2, 'inland summer build attic')
near(todayIn('inland', 'summer').readings.ceiling, 86, 0.5, 'inland summer ceiling today, under a 140 °F attic')
near(buildIn('inland', 'summer').readings.ceiling, 78.2, 0.5, 'inland summer build ceiling')
near(buildIn('inland', 'summer').load, 0.094, 0.02, 'inland summer build load')
near(todayIn('coastal', 'winter').readings.attic, 43.7, 0.5, 'coastal winter attic today')
near(buildIn('coastal', 'winter').readings.attic, 39, 1, 'coastal winter attic build')
near(todayIn('coastal', 'winter').readings.attic - buildIn('coastal', 'winter').readings.attic, 5, 0.5, 'R44 attic gap')
near(todayIn('coastal', 'winter').readings.roof - buildIn('coastal', 'winter').readings.roof, 2, 0.5, 'R44 roof gap')

// The default home's parts, with some materials swapped; a part the list lacks is added modelled on its neighbours.
const existingHeatParts = roofAttic(resolveScene(inputs({ property: shingleR11, weather: 'summer', climate: 'inland' }), cuts)).parts
function withMaterials(parts: readonly ResolvedPart[], swaps: Record<string, string | null>): ResolvedPart[] {
  const swapped = parts.map(part => (part.id in swaps ? { ...part, material: swaps[part.id]! } : part))
  const added = Object.entries(swaps).filter(([id]) => !swapped.some(part => part.id === id)).map(([id, material]) => ({ ...swapped[0]!, id, material }))
  return [...swapped, ...added]
}
function heatOf(climate: Climate, weather: HeatWeather, swaps: Record<string, string | null>, shell: Partial<HomeShell> = {}) {
  return homeHeat(climate, weather, { parts: withMaterials(existingHeatParts, swaps), form: 'pitched', ...shell })
}
const LADDER = [null, 'batts-r11', 'batts-r19', 'batts-r30', 'blown-r38']

for (const climate of CLIMATES) {
  for (const covering of ['shingle', 'cool-shingle', 'tile']) {
    for (const barrier of [null, 'foil']) {
      for (const sealed of [null, 'sealed']) {
        const ladderIn = (weather: HeatWeather) => LADDER.map(insulation => heatOf(climate, weather, { 'covering': covering, 'radiant-barrier': barrier, 'air-sealing': sealed, 'attic-insulation': insulation }).readings)
        for (const weather of ['normal', 'summer'] as const) {
          const rungs = ladderIn(weather)
          for (let i = 1; i < rungs.length; i++) {
            const label = `${climate} ${weather} ${covering} ${barrier} ${sealed} rung ${i}`
            assert.ok(rungs[i]!.attic <= rungs[i - 1]!.attic, `${label}: the attic never rises up the ladder`)
            assert.ok(rungs[i]!.ceiling <= rungs[i - 1]!.ceiling, `${label}: the ceiling never rises up the ladder`)
          }
        }
        const winter = ladderIn('winter')
        for (let i = 1; i < winter.length; i++) {
          const label = `${climate} winter ${covering} ${barrier} ${sealed} rung ${i}`
          assert.ok(winter[i]!.attic <= winter[i - 1]!.attic, `${label}: the attic never rises up the ladder`)
          assert.ok(winter[i]!.ceiling >= winter[i - 1]!.ceiling, `${label}: the ceiling never falls up the ladder`)
        }
      }
    }
  }
}

assert.equal(atticFanRuns('thermostat-fan', 100.1), true, 'over 100 runs')
assert.equal(atticFanRuns('thermostat-fan', 100), false, '100 itself idles')
assert.equal(atticFanRuns('thermostat-fan', 99.9), false, 'under 100 idles')
assert.equal(atticFanRuns(null, 140), false, 'no fan, nothing runs')

const FAN = { 'attic-fan': 'thermostat-fan' } as const
const shakeNormal = heatOf('inland', 'normal', { covering: 'wood-shake' })
const shakeNormalFan = heatOf('inland', 'normal', { covering: 'wood-shake', ...FAN })
assert.equal(shakeNormalFan.atticFanRunning, true, 'inland wood shakes on a normal day run the fan')
near(shakeNormalFan.readings.attic, shakeNormal.readings.attic - 6, 1e-9, 'normal: attic -6')
near(shakeNormalFan.readings.ceiling, shakeNormal.readings.ceiling - 0.4, 1e-9, 'normal: ceiling -0.4')
near(shakeNormalFan.load, shakeNormal.load * 0.96, 1e-9, 'normal: load x0.96')

const coastSummer = heatOf('coastal', 'summer', { covering: 'shingle' })
const coastSummerFan = heatOf('coastal', 'summer', { covering: 'shingle', ...FAN })
near(coastSummerFan.readings.attic, coastSummer.readings.attic - 20, 1e-9, 'summer: attic -20')
near(coastSummerFan.readings.ceiling, coastSummer.readings.ceiling - 1.5, 1e-9, 'summer: ceiling -1.5')
near(coastSummerFan.load, coastSummer.load * 0.9, 1e-9, 'summer: load x0.9')

const barrierShake = (fan: boolean) => heatOf('inland', 'normal', { 'covering': 'wood-shake', 'radiant-barrier': 'foil', ...(fan ? FAN : {}) })
assert.equal(barrierShake(true).atticFanRunning, false, 'barrier idles the fan')
assert.deepEqual({ ...barrierShake(true), atticFanRunning: false }, barrierShake(false), 'an Idle fan changes nothing')

for (const climate of CLIMATES) {
  for (const covering of ['shingle', 'cool-shingle', 'tile', 'wood-shake']) {
    for (const barrier of [null, 'foil']) {
      for (const sealed of [null, 'sealed']) {
        for (const insulation of LADDER) {
          const swaps = { 'covering': covering, 'radiant-barrier': barrier, 'air-sealing': sealed, 'attic-insulation': insulation, ...FAN }
          assert.equal(heatOf(climate, 'summer', swaps).atticFanRunning, true, `${climate} ${covering} ${barrier} ${sealed} ${insulation}: summer runs the fan`)
          assert.equal(heatOf(climate, 'winter', swaps).atticFanRunning, false, `${climate} ${covering} ${barrier} ${sealed} ${insulation}: winter never does`)
        }
      }
    }
  }
}

// An upgrade that raised the attic could switch the fan on by itself. A flat roof's materials are skipped: it has no fan.
for (const entry of Object.values(SCOPE_INSTALLS)) {
  for (const { part, material, swapsWith } of entry?.installs ?? []) {
    for (const installed of [material, ...Object.values(swapsWith ?? {})]) {
      const forms = entry && ASSEMBLIES[entry.assembly].parts.find(candidate => candidate.id === part)?.materials[installed]?.forms
      if (forms && !forms.includes('pitched')) {
        continue
      }
      for (const weather of ['normal', 'summer'] as const) {
        assert.ok((PART_HEAT_EFFECTS[part]?.[installed]?.[weather]?.readings?.attic ?? 0) <= 0, `${part} ${installed} ${weather}: never raises the attic`)
      }
    }
  }
}

// What the build changes is smaller on a mild afternoon than in a hot spell.
for (const climate of CLIMATES) {
  for (const reading of ['roof', 'attic', 'ceiling'] as const) {
    const gap = (weather: HeatWeather) => todayIn(climate, weather).readings[reading] - buildIn(climate, weather).readings[reading]
    assert.ok(gap('normal') < gap('summer'), `${climate} ${reading}: the build's gap is smaller in Normal than Summer`)
  }
  for (const reading of ['exterior-wall', 'window'] as const) {
    const gap = (weather: HeatWeather) => todayIn(climate, weather).readings[reading] - buildIn(climate, weather).readings[reading]
    assert.ok(gap('normal') <= gap('summer'), `${climate} ${reading}: the build's gap is no larger in Normal than Summer`)
  }
}

// Every upgrade lowers what gets through.
for (const climate of CLIMATES) {
  for (const weather of HEAT_WEATHERS) {
    const through = (swaps: Record<string, string | null>, shell: Partial<HomeShell> = {}) => heatLaneFlows(heatOf(climate, weather, swaps, shell))
    const label = `${climate} ${weather}`
    const lowers = (better: number, worse: number, what: string) => {
      assert.ok(better <= worse, `${label}: ${what} lets no more through`)
      if (weather === 'summer') {
        assert.ok(better < worse, `${label}: ${what} lets less through in summer`)
      }
    }
    const r11 = through({ 'attic-insulation': 'batts-r11' }).roof[2]
    for (const insulation of ['batts-r19', 'batts-r30', 'blown-r38']) {
      lowers(through({ 'attic-insulation': insulation }).roof[2], r11, insulation)
    }
    lowers(through({ 'radiant-barrier': 'foil' }).roof[2], through({ 'radiant-barrier': null }).roof[2], 'foil')
    lowers(through({ covering: 'cool-shingle' }).roof[2], through({ covering: 'shingle' }).roof[2], 'cool-shingle')
    lowers(through({ 'air-sealing': 'sealed' }).roof[2], through({ 'air-sealing': null }).roof[2], 'sealed')
    lowers(through({ glazing: 'double-pane' }).window[1], through({ glazing: 'single-pane' }).window[1], 'double windows')
    lowers(through({ paint: 'cool' }).wall[1], through({ paint: 'standard' }).wall[1], 'cool paint')
  }
}

// An effect applies once, however the home came to have it.
const wornR38 = existingHeatParts.map(part => (part.id === 'attic-insulation' ? { ...part, material: 'blown-r38', condition: 'worn' as const } : part))
const installedR38 = wornR38.map(part => (part.id === 'attic-insulation' ? { ...part, condition: 'installed' as const } : part))
assert.deepEqual(
  homeHeat('inland', 'summer', { parts: wornR38, form: 'pitched' }),
  homeHeat('inland', 'summer', { parts: installedR38, form: 'pitched' }),
  'worn and installed insulation count the same',
)
for (const [partId, material] of [['glazing', 'double-pane'], ['paint', 'cool'], ['duct-runs', 'r6-silver-flex'], ['duct-runs', 'r8-flex']] as const) {
  for (const weather of HEAT_WEATHERS) {
    const withPart = (condition: 'worn' | 'installed') => homeHeat('inland', weather, { parts: [{ ...existingHeatParts[0]!, id: partId, material, condition }], form: 'pitched' })
    assert.deepEqual(withPart('worn'), withPart('installed'), `${material} ${weather}: worn and installed count the same`)
  }
}
const windowsHeat = (patch: Partial<TradeSceneInputs['property']>) => at({ property: profile(patch), weather: 'winter', climate: 'coastal' }).heat
assert.deepEqual(windowsHeat({ yearBuilt: '1950-1978' }), windowsHeat({ yearBuilt: '1950-1978', windowsType: 'single' }), 'unknown windows follow an old era\'s single pane')
assert.deepEqual(windowsHeat({ yearBuilt: 'Post-2014' }), windowsHeat({ yearBuilt: 'Post-2014', windowsType: 'double' }), 'unknown windows follow a recent era\'s double pane')

// A flat home with unknown insulation still reads and flows.
const flatUnknown = profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: null })
for (const climate of CLIMATES) {
  for (const weather of HEAT_WEATHERS) {
    const shell = shellOf(resolveScene(inputs({ property: flatUnknown, weather, climate }), cuts))
    const heat = homeHeat(climate, weather, shell)
    const label = `flat unknown ${climate} ${weather}`
    assert.ok(Object.values(heat.readings).every(Number.isFinite), `${label}: readings are finite`)
    assert.ok([heat.flows.roofSource, ...heat.flows.roofPasses, heat.flows.wall, heat.flows.window, heat.flows.wallPasses, heat.flows.windowPasses, heat.load].every(Number.isFinite), `${label}: flows and load are finite`)
    assert.ok(heatLaneFlows(heat).roof[2] > HEAT_FLOW_STOPPED, `${label}: the heat still reaches the room`)
    if (weather === 'summer') {
      const withR11 = homeHeat(climate, weather, { ...shell, parts: withMaterials(shell.parts, { 'attic-insulation': 'batts-r11' }) })
      assert.ok(heat.readings.ceiling > withR11.readings.ceiling, `${label}: no insulation reads a hotter ceiling than R-11`)
      assert.equal(heat.readings.attic, withR11.readings.attic, `${label}: insulation leaves the attic as hot as it was`)
    }
  }
}

// The lane arithmetic.
const lanes = heatLaneFlows({
  readings: STARTING_HOME_HEAT.inland.summer.readings,
  flows: { roofSource: 1, roofPasses: [0.5, 0.5], wall: 0.8, window: 0.5, wallPasses: 0.5, windowPasses: 0.4 },
  bounce: { covering: 0.2, barrier: 0.5, wall: 0.25, window: 0.2 },
  load: 0.5,
  atticFanRunning: false,
})
for (const [actual, expected, what] of [[lanes.roof[0], 1, 'roof 0'], [lanes.roof[1], 0.2, 'roof 1'], [lanes.roof[2], 0.1, 'roof 2'], [lanes.coveringBounce, 0.2, 'covering bounce'], [lanes.barrierBounce, 0.4, 'barrier bounce'], [lanes.wall[0], 0.8, 'wall source'], [lanes.wall[1], 0.3, 'wall through'], [lanes.wallBounce, 0.2, 'wall bounce'], [lanes.window[0], 0.5, 'window source'], [lanes.window[1], 0.16, 'window through'], [lanes.windowBounce, 0.1, 'window bounce']] as const) {
  near(actual, expected, 1e-9, `lane ${what}`)
}

// A wall or a window takes the climate's and the weather's sun whatever part the home has: the part only turns some of it
// back and lets less of the rest in. Counted as [the sun's arrows, the bounce's, the arrows that get in].
const count = (flow: number) => heatArrowLane([], flow).count
const bounceCount = (flow: number) => bounceArrowLane([[0, 0, 0], [0, 1, 0]], flow)?.count ?? 0
function faceArrows(climate: Climate, weather: HeatWeather, face: 'wall' | 'window', swaps: Record<string, string>) {
  const flows = heatLaneFlows(heatOf(climate, weather, swaps))
  return [count(flows[face][0]), bounceCount(face === 'wall' ? flows.wallBounce : flows.windowBounce), count(flows[face][1])]
}
const SUMMER_FACE_ARROWS: readonly (readonly [Climate, string, 'wall' | 'window', Record<string, string>, readonly number[]])[] = [
  ['inland', 'existing windows', 'window', {}, [4, 0, 4]],
  ['inland', 'double pane', 'window', { glazing: 'double-pane' }, [4, 1, 2]],
  ['inland', 'existing paint', 'wall', {}, [3, 0, 3]],
  ['inland', 'Cool Life', 'wall', { paint: 'cool' }, [3, 1, 1]],
  ['coastal', 'existing windows', 'window', {}, [3, 0, 3]],
  ['coastal', 'double pane', 'window', { glazing: 'double-pane' }, [3, 1, 1]],
  ['coastal', 'Cool Life', 'wall', { paint: 'cool' }, [2, 1, 1]],
]
for (const [climate, part, face, swaps, expected] of SUMMER_FACE_ARROWS) {
  assert.deepEqual(faceArrows(climate, 'summer', face, swaps), expected, `${climate} summer ${part}: sun / bounce / inside arrows`)
}
// A mild day's bounce stays under the whole-arrow rule, as the cool roof's does.
assert.deepEqual(faceArrows('inland', 'normal', 'window', { glazing: 'double-pane' }), [2, 0, 1], 'inland Normal double pane: sun / bounce / inside arrows')
assert.deepEqual(faceArrows('inland', 'normal', 'wall', { paint: 'cool' }), [1, 0, 1], 'inland Normal Cool Life: sun / bounce / inside arrows')
// Winter runs from the room out: the room's side carries more than what escapes, and nothing bounces.
const winterWindow = heatLaneFlows(heatOf('inland', 'winter', { glazing: 'double-pane' })).window
assert.ok(winterWindow[1] < winterWindow[0], 'inland winter double pane: less escapes than leaves the room')
assert.deepEqual(faceArrows('inland', 'winter', 'window', { glazing: 'double-pane' }), [4, 0, 2], 'inland winter double pane: room / bounce / escaping arrows')
const UPGRADED_FACES = { glazing: 'double-pane', paint: 'cool' }
for (const climate of CLIMATES) {
  for (const weather of HEAT_WEATHERS) {
    const sun = (swaps: Record<string, string>) => heatLaneFlows(heatOf(climate, weather, swaps))
    assert.equal(sun(UPGRADED_FACES).window[0], sun({}).window[0], `${climate} ${weather}: double pane never changes the window's sun`)
    assert.equal(sun(UPGRADED_FACES).wall[0], sun({}).wall[0], `${climate} ${weather}: Cool Life never changes the wall's sun`)
  }
}
// Only what the arrows draw moved: the readings and the load are the figures they were.
for (const [climate, weather, readings, load] of [
  ['inland', 'summer', { 'roof': 166.1, 'attic': 140.2, 'ceiling': 86, 'exterior-wall': 110, 'window': 82 }, 0.485925],
  ['coastal', 'winter', { 'roof': 40.7, 'attic': 43.7, 'ceiling': 65.8, 'exterior-wall': 46, 'window': 67 }, 0.5115],
] as const) {
  const heat = heatOf(climate, weather, UPGRADED_FACES)
  assert.deepEqual(heat.readings, readings, `${climate} ${weather}: double pane and Cool Life read as they did`)
  near(heat.load, load, 1e-9, `${climate} ${weather}: double pane and Cool Life load`)
}

// Every string the screen can show, from every copy object, says "your" only in the recorded-basis title and never mentions solar.
const SAMPLE_ARGS: readonly unknown[][] = [
  ...['electric', 'gas'].map(category => [category]),
  ...SCENE_WEATHERS.map(weather => [weather]),
  ...Object.values(HOME_SCENE_COPY.ERA_PHRASE).map(phrase => [phrase]),
  ...CLIMATES.flatMap(climate => (['normal', 'summer', 'winter'] as const).map(weather => [climate, weather])),
  ['Good', '5', '10'],
]
function copyStrings(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') {
    return [[path, value]]
  }
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    // A sample the function cannot take (a weather where it wants a bill) throws and is skipped; every function must take one.
    const lines = SAMPLE_ARGS.filter(args => args.length >= fn.length).flatMap((args) => {
      try {
        return copyStrings(fn(...args), `${path}(${args.join(', ')})`)
      }
      catch {
        return []
      }
    })
    assert.ok(lines.length > 0, `${path}: the copy walk found arguments it takes`)
    return lines
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => copyStrings(entry, `${path}.${key}`))
  }
  return []
}
// The recorded title is the one line allowed "your"; the heading loop above proves it shows only over a recorded basis.
const RECORDED_TITLE = /^ASSEMBLY_HEADINGS\.[\w-]+\.title\.recorded\(/
const screenCopy = Object.entries(HOME_SCENE_COPY).flatMap(([name, value]) => copyStrings(value, name))
assert.ok(screenCopy.some(([path]) => path.startsWith('SAVINGS_COPY.')) && screenCopy.some(([path]) => path.startsWith('PANEL_COPY.')), 'the copy walk reaches the savings and panel copy')
for (const [path, line] of screenCopy) {
  assert.ok(RECORDED_TITLE.test(path) || !/\byour\b/i.test(line), `${path}: no "your" (${line})`)
  assert.ok(!/solar/i.test(line), `${path}: never solar (${line})`)
}

// A registered kit needs its existing conditions, its heading copy, its upgrades label, its anchor's pin label and its lazy
// drawing, or the home throws, shows a pin that opens nothing, or lists work under no name. The drawing's map loads
// three.js, so its keys are read from the source text.
const kitComponentKeys = new Set([...readFileSync(join('src/features/trade-scenes/constants/assembly-kit-components.ts'), 'utf8').matchAll(/^\s+'([\w-]+)': dynamic\(/gm)].map(match => match[1]))
for (const [id, kit] of Object.entries(ASSEMBLY_KITS) as [AssemblyId, AssemblyKit | undefined][]) {
  assert.ok(kit, `${id}: registered`)
  assert.ok(id in INFER_EXISTING_CONDITIONS, `${id}: existing conditions are inferred`)
  assert.ok(ASSEMBLY_HEADINGS[id], `${id}: has heading copy`)
  assert.ok(ASSEMBLY_LABELS[id], `${id}: has a label over its upgrades`)
  assert.ok(ANCHOR_PIN_LABELS[kit.anchor], `${id}: its anchor ${kit.anchor} has a pin label`)
  assert.ok(kitComponentKeys.has(id), `${id}: has a drawing in ASSEMBLY_KIT_COMPONENTS`)
  assert.ok((ASSEMBLY_SCREENS[id]?.length ?? 0) > 0, `${id}: has an assembly screen with at least one block`)
}

// The resolver tier stays free of three.js, so the resolver and these scripts never pull a renderer in.
const THREE_IMPORT = /^\s*import\s[^;]*?\sfrom\s+'(?:three|three\/[^']*|@react-three\/[^']*)'|^\s*import\s+'(?:three|three\/[^']*|@react-three\/[^']*)'|\bimport\(\s*'(?:three|three\/[^']*|@react-three\/[^']*)'/m
const pureTier = ['lib', 'constants'].flatMap(folder => readdirSync(join('src/features/trade-scenes', folder), { recursive: true, encoding: 'utf8' })
  .filter(file => /\.tsx?$/.test(file))
  .map(file => join('src/features/trade-scenes', folder, file)))
for (const file of [...pureTier, 'src/features/trade-scenes/types.ts']) {
  assert.ok(!THREE_IMPORT.test(readFileSync(file, 'utf8')), `${file}: imports three.js, so it belongs under ui/`)
}
assert.ok(THREE_IMPORT.test('import type { Mesh } from \'three\'\n') && THREE_IMPORT.test('import {\n  useFrame,\n} from \'@react-three/fiber\'\n') && THREE_IMPORT.test('import { mergeGeometries } from \'three/examples/jsm/utils/BufferGeometryUtils.js\'\n'), 'the three.js import check catches what it guards')

const ROOF_GROUP = [TEAR_OFF, GUTTERS]
const otherGroupKept = scopePreviewPatch({ proposedScopeIds: [ATTIC_REPLACEMENT], efficiencyUpgrades: ['cool-roof'] }, ROOF_GROUP, [GUTTERS])
assert.deepEqual(otherGroupKept.proposedScopeIds, [ATTIC_REPLACEMENT, GUTTERS], 'scopes outside the group are kept')
assert.deepEqual(scopePreviewPatch({ proposedScopeIds: [], efficiencyUpgrades: ['cool-roof'] }, ROOF_GROUP, [TEAR_OFF]), { proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: ['cool-roof'] }, 'the pick lands in the scope list and leaves the efficiency upgrades as they were')

assert.deepEqual(HOME_VIEWS, ['complete', 'partly-open'], 'the two home views, Complete first')
assert.equal(HOME_SCENE_DEFAULTS.homeView, 'complete', 'the scene opens on the Complete home')
assert.equal(HOME_SCENE_DEFAULTS.thermalCamera, false, 'the scene opens with no lens')
// A type-level check: tsc fails here if the home view ever joins what resolveScene reads.
const homeViewIsDrawingOnly: 'homeView' extends keyof SceneResolveInputs ? never : true = true
assert.ok(homeViewIsDrawingOnly)
const partlyOpen: TradeSceneInputs = { ...HOME_SCENE_DEFAULTS, homeView: 'partly-open' }
assert.notEqual(sceneBurstKey(partlyOpen), sceneBurstKey(HOME_SCENE_DEFAULTS), 'opening the house wakes the home')

for (const form of ['pitched', 'low-slope'] as const) {
  for (const id of READING_IDS) {
    assert.ok(HOME_SCENE_COPY.READING_COPY.labels[form][id], `${form}: ${id} has a label`)
    assert.ok(READING_ANCHORS[form][id].every(Number.isFinite), `${form}: ${id} has an anchor`)
  }
}
assert.ok(READING_IDS.every(id => READING_CALLOUTS[id] !== undefined), 'every reading stands on a callout')
assert.ok(INSIDE_READING_IDS.every(id => (READING_IDS as readonly string[]).includes(id)), 'the inside readings are readings')
const paintReadings = STARTING_HOME_HEAT.inland.summer.readings
const paintRead = homePaintTemperatures({ readings: paintReadings, equipmentLoad: 0, weather: 'summer', climate: 'inland' })
assert.equal(paintRead.sunlit, paintReadings['exterior-wall'], 'the sunlit wall paints at the exterior-wall reading')
assert.equal(paintRead.window, paintReadings.window, 'the glass paints at the window reading')
const paintRain = homePaintTemperatures({ readings: null, equipmentLoad: 0, weather: 'rain', climate: 'inland' })
assert.ok(Number.isFinite(paintRain.window), 'the glass has a temperature in Rain')

for (const climate of ['inland', 'coastal'] as const) {
  const summer = homePaintTemperatures({ readings: STARTING_HOME_HEAT[climate].summer.readings, equipmentLoad: 0, weather: 'summer', climate })
  assert.equal(summer.crawl, CRAWL_AIR[climate].summer, `${climate}: the crawl reads its ground air`)
  assert.ok(summer.crawl < CLIMATE_PRESETS[climate].summer.setpoint, 'the coolest spot on a summer afternoon')
  const winter = homePaintTemperatures({ readings: STARTING_HOME_HEAT[climate].winter.readings, equipmentLoad: 0, weather: 'winter', climate })
  assert.equal(winter.crawl, CRAWL_AIR[climate].winter, `${climate}: the crawl reads its winter ground air`)
  const normal = homePaintTemperatures({ readings: STARTING_HOME_HEAT[climate].normal.readings, equipmentLoad: 0, weather: 'normal', climate })
  assert.equal(normal.crawl, (CRAWL_AIR[climate].summer + CRAWL_AIR[climate].winter) / 2, `${climate}: Normal sits between the two`)
  for (const weather of ['summer', 'winter'] as const) {
    const sources = { readings: STARTING_HOME_HEAT[climate][weather].readings, equipmentLoad: 0, weather, climate }
    const bare = homePaintTemperatures(sources)
    const batts = homePaintTemperatures({ ...sources, crawlInsulated: true })
    const { setpoint } = CLIMATE_PRESETS[climate][weather]
    assert.equal(batts.crawl, bare.crawl, `${climate} ${weather}: insulation never changes the crawl air`)
    assert.ok(Math.abs(batts['crawl-floor'] - bare.crawl) <= 1, `${climate} ${weather}: an insulated floor reads the crawl air`)
    assert.ok(bare['crawl-floor'] > Math.min(bare.crawl, setpoint) && bare['crawl-floor'] < Math.max(bare.crawl, setpoint), `${climate} ${weather}: a bare floor reads between the crawl and the room`)
  }
  assert.ok(homePaintTemperatures({ readings: STARTING_HOME_HEAT[climate].winter.readings, equipmentLoad: 0, weather: 'winter', climate })['crawl-floor'] > winter.crawl, `${climate}: in winter a bare floor reads warmer than the crawl`)
}
// The orbit's polar clamp keeps the camera above ground only while the target is above it.
assert.ok(HOME_ANCHORS.pitched['under-floor'].framing.target[1] > 0, 'the crawl framing never looks from below ground')

// Arrows on a lane: how many and how fast come from the flow alone; where each sits comes from the clock.
const ARROW_LANE_POINTS = [[0, 0, 0], [2, 0, 0]] as const
assert.deepEqual([heatArrowLane(ARROW_LANE_POINTS, 1).count, heatArrowLane(ARROW_LANE_POINTS, 1).speed], [5, 1.2], 'a full flow runs five arrows at full speed')
assert.equal(heatArrowLane(ARROW_LANE_POINTS, 0.01).count, 0, 'a flow under the stop line runs no arrows')
assert.equal(heatArrowLane(ARROW_LANE_POINTS, 0.05).count, 1, 'a trickle still runs one arrow')
const halfLane = heatArrowLane(ARROW_LANE_POINTS, 0.5)
assert.equal(halfLane.count, 3, 'half the flow rounds 2.5 arrows up to 3')
assert.ok(Math.abs(halfLane.speed - 0.775) < 1e-9, 'half the flow runs at half the speed range')
assert.deepEqual([halfLane.flow, heatArrowLane(ARROW_LANE_POINTS, 1.1).flow, heatArrowLane(ARROW_LANE_POINTS, -0.2).flow], [0.5, 1, 0], 'the lane carries its flow, held to 0..1, for the arrows to shrink and dull by')
assert.equal(heatArrowLane(ARROW_LANE_POINTS, 1).points, ARROW_LANE_POINTS, 'the lane carries its points through')
const straightLane = { points: ARROW_LANE_POINTS, count: 4, speed: 1, flow: 1 }
const atRest = arrowStations(straightLane, 0)
assert.deepEqual(atRest.map(station => station.position[0]), [0.25, 0.75, 1.25, 1.75], 'arrows are spaced evenly along the lane, half a spacing in from each end')
assert.ok(atRest.every(station => station.direction[0] === 1 && station.direction[1] === 0 && station.direction[2] === 0), 'every arrow on a straight lane points along it')
assert.deepEqual(arrowStations(straightLane, 2), atRest, 'one full lap brings every arrow back')
assert.equal(arrowStations(straightLane, 0.25)[0].position[0], 0.5, 'the arrows move along the lane at its speed')
// Reduced motion holds the arrows at the clock's start, so every arrow there must show or a one-arrow lane vanishes.
for (const lane of [straightLane, { ...straightLane, count: 1 }, { ...straightLane, count: 5 }, { points: [[0, 0, 0], [0.3, 0, 0]] as const, count: 2, speed: 1, flow: 1 }]) {
  const stations = arrowStations(lane, 0)
  assert.equal(stations.length, lane.count, `at rest a lane of ${lane.count} shows ${lane.count} stations`)
  assert.ok(stations.every(station => station.fade > 0), `at rest every one of a lane's ${lane.count} arrows is lit`)
}
assert.equal(atRest[2].fade, 1, 'an arrow mid-lane is fully lit')
const atStart = arrowStations(straightLane, 1.75)[0]
assert.deepEqual([atStart.position[0], atStart.fade], [0, 0], 'moving, an arrow at the start of the lane is faded out')
const nearStart = arrowStations(straightLane, 1.76)[0]
const nearEnd = arrowStations(straightLane, 1.74)[0]
assert.ok(nearStart.position[0] < 0.02 && nearStart.fade < 0.05, `moving, an arrow just past the start is still faint (${nearStart.fade})`)
assert.ok(nearEnd.position[0] > 1.98 && nearEnd.fade < 0.05, `moving, an arrow about to leave the end is faint (${nearEnd.fade})`)
const bentStations = arrowStations({ points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], count: 4, speed: 1, flow: 1 }, 0)
assert.deepEqual(bentStations[3].position, [1, 0.75, 0], 'an arrow past the corner sits on the second leg')
assert.deepEqual(bentStations[3].direction, [0, 1, 0], 'an arrow past the corner points along the second leg')
assert.deepEqual(arrowStations({ ...straightLane, count: 0 }, 0), [], 'a lane with no arrows has no stations')
assert.deepEqual(arrowStations({ ...straightLane, points: [[0, 0, 0]] }, 0), [], 'a lane of one point has no stations')
assert.deepEqual(arrowStations(straightLane, 0), arrowStations(straightLane, 0), 'stations are a pure function of the lane and the clock')

// The whole home's lanes: the roof's three segments per lane, the sunny wall, every window; the build thins them out.
const ROOF_LANES = HOME_ROOF_HEAT_LANES.pitched
function lanesFrom(lanes: readonly ArrowLane[], from: Vec3, to: Vec3) {
  return lanes.filter(lane => lane.points.length === 2 && lane.points[0] === from && lane.points[1] === to)
}
function lanesAlong(lanes: readonly ArrowLane[], pick: (roof: RoofHeatLane) => readonly [Vec3, Vec3], form: RoofForm = 'pitched') {
  return HOME_ROOF_HEAT_LANES[form].flatMap(roof => lanesFrom(lanes, ...pick(roof)))
}
function arrowsOn(lanes: readonly ArrowLane[]) {
  return lanes.reduce((sum, lane) => sum + lane.count, 0)
}
const OPEN_FACE_LANES: readonly WallHeatLane[] = [...HOME_WALL_HEAT_LANES, ...HOME_WINDOW_HEAT_LANES]
const COMPLETE_FACE_LANES: readonly CompleteWallLane[] = [...HOME_COMPLETE_WALL_HEAT_LANES, ...HOME_COMPLETE_WINDOW_HEAT_LANES]
const FACE_LANES = [...OPEN_FACE_LANES, ...COMPLETE_FACE_LANES]
function bounceLanes(lanes: readonly ArrowLane[], form: RoofForm = 'pitched') {
  return [
    ...lanesAlong(lanes, roof => [roof.covering, roof.coveringBounceTo], form),
    ...lanesAlong(lanes, roof => [roof.barrier, roof.barrierBounceTo], form),
    ...FACE_LANES.flatMap(face => lanesFrom(lanes, face.face, face.bounceTo)),
  ]
}
function legArrows(lanes: readonly ArrowLane[], from: Vec3, to: Vec3) {
  const found = lanesFrom(lanes, from, to)
  assert.ok(found.length <= 1, 'a leg is drawn once')
  return found[0]?.count ?? 0
}
function sceneHeat(overrides: Partial<TradeSceneInputs>) {
  const heat = resolveScene(inputs({ property: shingleR11, climate: 'inland', ...overrides }), cuts).heat
  assert.ok(heat !== null, 'the home has heat to draw')
  return heat
}
const summerHeat = sceneHeat({ weather: 'summer' })
const summerFlows = heatLaneFlows(summerHeat)
const summerLanes = homeHeatLanes('pitched', summerHeat, 'summer', 'partly-open', null, [])
assert.equal(ROOF_LANES.length, 3, 'three lanes cross the roof')
assert.deepEqual(
  [HOME_WALL_HEAT_LANES.length, HOME_COMPLETE_WALL_HEAT_LANES.length, HOME_WINDOW_HEAT_LANES.length, HOME_COMPLETE_WINDOW_HEAT_LANES.length],
  [4, 6, 4, 6],
  'two lanes cross every wall the view shows, and one crosses every window, but where the garage stands',
)
// The garage stands against the right wall, and no lane crosses the wall under it, its eaves included: every corner of
// every garage box, its tilted slopes too, in either roof form.
const GARAGE_ROOF_Z = (() => {
  const zs = Object.values(GARAGE_BOXES).flatMap(boxes => Object.values(boxes).flat()).flatMap(({ size, position, rotation }) =>
    [-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(sz =>
      new Vector3(sx * size[0] / 2, sy * size[1] / 2, sz * size[2] / 2).applyEuler(new Euler(...(rotation ?? [0, 0, 0]))).z + position[2]))))
  return { from: Math.min(...zs), to: Math.max(...zs) }
})()
assert.ok(GARAGE_ROOF_Z.from < GARAGE.z0 && GARAGE_ROOF_Z.to > GARAGE.z1, 'the garage roof reaches past its walls')
const inGarageSpan = (wall: HouseWall, along: number) => wall === HOUSE_WALLS.right && along > GARAGE_ROOF_Z.from && along < GARAGE_ROOF_Z.to
assert.equal(HOME_WINDOW_HEAT_LANES.length, Object.values(HOUSE_WALLS).reduce((sum, wall) => sum + wall.openings.filter(opening => !inGarageSpan(wall, opening.along)).length, 0), 'the open house has a lane through every window outside the garage\'s span')
assert.equal(HOME_COMPLETE_WINDOW_HEAT_LANES.length, HOME_WINDOW_HEAT_LANES.length + FRONT_WALL.openings.length, 'the Complete house has a lane through every window, the front\'s included')
// A wall lane crosses stucco, never glass, the front door or the steps up to it; it stands on its wall as the wall's boxes
// do, off the face by the standoff.
const LANE_WALLS = { ...HOUSE_WALLS, front: FRONT_WALL }
const FACE_OUT = HOUSE.wallThickness / 2 + LANE_STANDOFF
const FRONT_STEPS_SPAN = { along: FRONT_DOOR.along, width: FRONT_STEPS.width }
for (const [view, wallLanes, expected] of [
  ['open', HOME_WALL_HEAT_LANES, { back: 2, left: 2, right: 0, front: 0 }],
  ['Complete', HOME_COMPLETE_WALL_HEAT_LANES, { back: 2, left: 2, right: 0, front: 2 }],
] as const) {
  const perWall = { back: 0, left: 0, right: 0, front: 0 }
  for (const lane of wallLanes) {
    const on = Object.entries(LANE_WALLS).filter(([, wall]) => Math.abs(lane.face[wall.run === 'x' ? 2 : 0] - (wall.line + wall.outward * FACE_OUT)) < 1e-9)
    assert.equal(on.length, 1, `${view}: a wall lane's face stands off one wall`)
    const [name, wall] = on[0] as [keyof typeof perWall, HouseWall]
    perWall[name]++
    const along = lane.face[wall.run === 'x' ? 0 : 2]
    const keepClear = name === 'front' ? [...FRONT_OPENINGS, FRONT_STEPS_SPAN] : wall.openings
    for (const opening of keepClear) {
      const gap = Math.abs(along - opening.along) - opening.width / 2
      assert.ok(gap >= 0.3, `${view} ${name} wall: the lane at ${along} clears the opening at ${opening.along} by ${gap.toFixed(2)} m`)
    }
  }
  assert.deepEqual(perWall, expected, `${view}: the wall lanes per wall`)
}
for (const lane of [...OPEN_FACE_LANES, ...COMPLETE_FACE_LANES]) {
  const onRight = Math.abs(lane.face[0] - (HOUSE_WALLS.right.line + FACE_OUT)) < 1e-9
  assert.ok(!(onRight && inGarageSpan(HOUSE_WALLS.right, lane.face[2])), `no lane crosses the right wall under the garage, eaves included (along ${lane.face[2]})`)
}
for (const [x, z] of DOWNSPOUTS.pitched.at) {
  assert.ok(!(x > GARAGE.x0 && x < GARAGE.x1 && z > GARAGE.z0 && z < GARAGE.z1), `no downspout stands inside the garage (${x}, ${z})`)
}
type RoofLeg = (roof: RoofHeatLane) => readonly [Vec3, Vec3]
const SUMMER_ROOF_LEGS: readonly RoofLeg[] = [roof => [roof.sky, roof.covering], roof => [roof.covering, roof.atticFloor], roof => [roof.atticFloor, roof.room]]
for (const pick of SUMMER_ROOF_LEGS) {
  assert.equal(lanesAlong(summerLanes, pick).length, 3, 'summer runs every roof lane sky → covering → attic floor → room')
}
for (const lane of OPEN_FACE_LANES) {
  assert.equal(lanesFrom(summerLanes, lane.outside, lane.face).length + lanesFrom(summerLanes, lane.face, lane.inside).length, 2, 'summer runs every wall and window lane outside → face → inside')
}
assert.equal(bounceLanes(summerLanes).length, 0, 'a regular shingle, the existing paint and the existing glass bounce nothing')
assert.equal(bounceLanes(homeHeatLanes('pitched', summerHeat, 'summer', 'complete', 'shingle', [])).length, 0, 'nor on the Complete house')
assert.equal(summerLanes.length, 9 + 2 * OPEN_FACE_LANES.length, 'two legs through every wall lane and every window of the house')
assert.ok(summerLanes.every(lane => lane.count > 0), 'a lane with no arrows is dropped')
const roomArrows = (lanes: readonly ArrowLane[]) => arrowsOn(lanesAlong(lanes, roof => [roof.atticFloor, roof.room]))
assert.equal(roomArrows(summerLanes), 3 * heatArrowLane([], summerFlows.roof[2]).count, 'the room segments carry what gets past the insulation')
for (const roof of ROOF_LANES) {
  const legFlows = SUMMER_ROOF_LEGS.map(pick => lanesFrom(summerLanes, ...pick(roof))[0].flow)
  assert.ok(legFlows[0] > legFlows[1] && legFlows[1] > legFlows[2], `each layer the heat crosses leaves its arrows smaller and duller (${legFlows.join(' → ')})`)
}

const builtHeat = sceneHeat({ weather: 'summer', view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'] })
const builtLanes = homeHeatLanes('pitched', builtHeat, 'summer', 'partly-open', null, [])
assert.equal(lanesAlong(builtLanes, roof => [roof.covering, roof.coveringBounceTo]).length, 3, 'the cool roof turns arrows back off every roof lane')
assert.equal(lanesAlong(builtLanes, roof => [roof.barrier, roof.barrierBounceTo]).length, 3, 'the radiant barrier turns arrows back up on every roof lane')
assert.ok(roomArrows(builtLanes) < roomArrows(summerLanes), `the build lets fewer arrows into the rooms (${roomArrows(builtLanes)} vs ${roomArrows(summerLanes)})`)

const winterHeat = sceneHeat({ weather: 'winter' })
const winterFlows = heatLaneFlows(winterHeat)
const winterLanes = homeHeatLanes('pitched', winterHeat, 'winter', 'partly-open', null, [])
assert.equal(lanesAlong(winterLanes, roof => [roof.room, roof.atticFloor]).length, 3, 'winter roof lanes start in the room')
assert.equal(lanesAlong(winterLanes, roof => [roof.atticFloor, roof.covering]).length, 3, 'winter carries the heat on up through the attic')
assert.equal(lanesAlong(winterLanes, roof => [roof.covering, roof.sky]).length, 3, 'winter roof lanes end in the sky')
assert.equal(lanesAlong(winterLanes, roof => [roof.sky, roof.covering]).length, 0, 'nothing runs inward in winter')
for (const lane of OPEN_FACE_LANES) {
  assert.equal(lanesFrom(winterLanes, lane.inside, lane.face).length + lanesFrom(winterLanes, lane.face, lane.outside).length, 2, 'winter runs every wall and window lane inside → face → outside')
  assert.equal(lanesFrom(winterLanes, lane.outside, lane.face).length + lanesFrom(winterLanes, lane.face, lane.inside).length, 0, 'no wall or window lane runs inward in winter')
}
assert.equal(bounceLanes(winterLanes).length, 0, 'winter bounces nothing')
assert.equal(arrowsOn(lanesAlong(winterLanes, roof => [roof.room, roof.atticFloor])), 3 * heatArrowLane([], winterFlows.roof[0]).count, 'the room side carries the heat the rooms lose')
const builtWinterLanes = homeHeatLanes('pitched', sceneHeat({ weather: 'winter', view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'] }), 'winter', 'partly-open', null, [])
assert.equal(bounceLanes(builtWinterLanes).length, 0, 'a cool roof bounces nothing in winter')

const outwardOf = (point: Vec3) => Math.abs(point[0]) > HOUSE.halfLength - HOUSE.wallThickness || point[2] < -HOUSE.halfDepth + HOUSE.wallThickness
for (const { outside, face, inside } of HOME_WINDOW_HEAT_LANES) {
  assert.ok(outwardOf(outside) && outwardOf(face), 'a window\'s outside leg runs from the yard to the glass\'s face')
  assert.ok(outwardOf(face) && !outwardOf(inside), 'a window\'s inside leg runs from the glass\'s face into the room')
  near(Math.hypot(outside[0] - inside[0], outside[1] - inside[1], outside[2] - inside[2]), 2 * OPEN_LANE_REACH, 1e-9, 'a window lane runs the open reach either side of the glass')
  // In flow order from the sun: what lands on the glass, then what gets through it.
  assert.deepEqual([legArrows(summerLanes, outside, face), legArrows(summerLanes, face, inside)], summerFlows.window.map(count), 'every window carries the sun on the glass, then what gets through')
  assert.deepEqual([legArrows(winterLanes, inside, face), legArrows(winterLanes, face, outside)], winterFlows.window.map(count), 'every window carries the room\'s heat to the glass, then what escapes')
}

// Inland summer with double pane and Cool Life: the sun's arrows are the existing home's, one turns back off every face,
// and fewer get in. The existing home turns none back.
const facesHeat = heatOf('inland', 'summer', UPGRADED_FACES)
const facesOpen = homeHeatLanes('pitched', facesHeat, 'summer', 'partly-open', null, [])
const facesComplete = homeHeatLanes('pitched', facesHeat, 'summer', 'complete', 'shingle', [])
for (const [what, open, complete, expected] of [
  ['window', HOME_WINDOW_HEAT_LANES, HOME_COMPLETE_WINDOW_HEAT_LANES, [4, 2, 1]],
  ['wall', HOME_WALL_HEAT_LANES, HOME_COMPLETE_WALL_HEAT_LANES, [3, 1, 1]],
] as const) {
  for (const lane of open) {
    assert.deepEqual([legArrows(facesOpen, lane.outside, lane.face), legArrows(facesOpen, lane.face, lane.inside), legArrows(facesOpen, lane.face, lane.bounceTo)], expected, `inland summer, Partly open: every ${what} lane draws sun / inside / bounce`)
    assert.equal(lanesFrom(facesOpen, lane.outside, lane.bounceTo).length, 0, `a ${what}'s bounce leaves its face, never the yard`)
  }
  for (const lane of complete) {
    assert.deepEqual([legArrows(facesComplete, lane.outside, lane.face), legArrows(facesComplete, lane.face, lane.bounceTo)], [expected[0], expected[2]], `inland summer, Complete: every ${what} lane draws sun / bounce`)
  }
}
const winterFacesHeat = heatOf('inland', 'winter', UPGRADED_FACES)
const winterFacesOpen = homeHeatLanes('pitched', winterFacesHeat, 'winter', 'partly-open', null, [])
const winterFacesComplete = homeHeatLanes('pitched', winterFacesHeat, 'winter', 'complete', 'shingle', [])
assert.equal(bounceLanes(winterFacesOpen).length + bounceLanes(winterFacesComplete).length, 0, 'double pane and Cool Life bounce nothing in winter')
const winterFaceFlows = heatLaneFlows(winterFacesHeat)
for (const lane of OPEN_FACE_LANES) {
  assert.equal(lanesFrom(winterFacesOpen, lane.inside, lane.face).length + lanesFrom(winterFacesOpen, lane.face, lane.outside).length, 2, 'winter runs the upgraded faces inside → face → outside')
}
for (const lane of HOME_COMPLETE_WINDOW_HEAT_LANES) {
  assert.equal(legArrows(winterFacesComplete, lane.face, lane.outside), count(winterFaceFlows.window[1]), 'winter on the Complete house: a double-pane window\'s outside leg carries what escapes')
  assert.equal(legArrows(winterFacesComplete, lane.face, lane.outside), 2, 'inland winter: two arrows escape a double-pane window')
}

const WINDOW_POINTS = new Set<Vec3>([...HOME_WINDOW_HEAT_LANES, ...HOME_COMPLETE_WINDOW_HEAT_LANES].flatMap(lane => Object.values(lane)))
const windowLanes = (lanes: readonly ArrowLane[]) => lanes.filter(lane => lane.points.every(point => WINDOW_POINTS.has(point)))
assert.deepEqual(lanesAlong(homeHeatLanes('pitched', sceneHeat({ weather: 'normal' }), 'summer', 'partly-open', null, []), roof => [roof.sky, roof.covering]).length, 3, 'Normal runs inward, as summer does')
assert.notDeepEqual(HOME_ROOF_HEAT_LANES['low-slope'], HOME_ROOF_HEAT_LANES.pitched, 'a flat roof has its own roof lanes')
// A bounce gets no one-arrow floor: less than a whole arrow's worth is not drawn, so a mild day's cool roof adds nothing.
// A bounce gets no one-arrow floor: what rounds to no arrow is not drawn, so a mild day's cool roof adds nothing.
assert.equal(bounceArrowLane(ARROW_LANE_POINTS, 0.05), null, 'a bounce worth less than an arrow is dropped')
assert.equal(bounceArrowLane(ARROW_LANE_POINTS, HEAT_FLOW_STOPPED / 2), null, 'a bounce under the stop line is dropped')
assert.deepEqual(bounceArrowLane(ARROW_LANE_POINTS, 0.5), heatArrowLane(ARROW_LANE_POINTS, 0.5), 'a bounce worth arrows runs as any lane does')
assert.equal(bounceArrowLane(ARROW_LANE_POINTS, 0.5 / HEAT_ARROW_SCALE.arrowsAtFull), null, 'half an arrow of bounce is not rounded up to one')
assert.equal(bounceArrowLane(ARROW_LANE_POINTS, 1 / HEAT_ARROW_SCALE.arrowsAtFull)?.count, 1, 'a whole arrow of bounce draws one')

// Today against the full build with the cool roof, every climate and weather: on the default home the build never lets
// more heat through, and on a mild or cold day never draws more arrows at all. Every lane leaves its arrows room to read apart.
const laneLength = (lane: ArrowLane) => lane.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((value, axis) => value - lane.points[i][axis]) as [number, number, number]), 0)
const MIN_ARROW_SPACING = 0.5 * HEAT_ARROW_LOOK.size.home
const HOMES_BY_FORM: Record<RoofForm, { property: PropertyProfile, build: string[] }> = {
  'pitched': { property: shingleR11, build: FULL_BUILD },
  'low-slope': { property: profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: 'low' }), build: [TORCH_DOWN, ATTIC_REPLACEMENT] },
}
const tightest = new Map<string, number>()
for (const climate of CLIMATES) {
  for (const weather of HEAT_WEATHERS) {
    const season = weather === 'winter' ? 'winter' : 'summer'
    for (const form of ROOF_FORMS) {
      const counts = [false, true].map((build) => {
        const home = HOMES_BY_FORM[form]
        const lanes = homeHeatLanes(form, sceneHeat({ property: home.property, climate, weather, ...(build ? { view: 'proposed', proposedScopeIds: home.build, efficiencyUpgrades: ['cool-roof'] } : {}) }), season, 'partly-open', null, [])
        for (const lane of lanes) {
          const spacing = laneLength(lane) / lane.count
          assert.ok(spacing >= MIN_ARROW_SPACING, `${form} ${climate} ${weather} ${build ? 'build' : 'today'}: a lane of ${laneLength(lane).toFixed(2)} m holds ${lane.count} arrows, ${spacing.toFixed(2)} m apart`)
          const key = `${form} ${laneLength(lane).toFixed(2)} m`
          tightest.set(key, Math.min(tightest.get(key) ?? Infinity, spacing))
        }
        const bounces = bounceLanes(lanes, form)
        if (form === 'pitched' && weather === 'normal') {
          assert.equal(bounces.length, 0, `${form} ${climate} normal ${build ? 'build' : 'today'}: a mild day bounces nothing`)
        }
        return { inward: arrowsOn(lanes) - arrowsOn(bounces), total: arrowsOn(lanes) }
      })
      const [today, built] = counts
      const label = `${form} ${climate} ${weather}`
      console.log(`  arrows ${label}: today ${today.inward} in / ${today.total} all, build ${built.inward} in / ${built.total} all`)
      // The flat roof's cool membrane turns back enough to bounce even on a mild day, so only its inward arrows are held.
      if (form !== 'pitched') {
        assert.ok(built.inward <= today.inward, `${label}: the build lets in ${built.inward} arrows against today's ${today.inward}`)
        continue
      }
      assert.ok(weather === 'summer' ? built.inward < today.inward : built.inward <= today.inward, `${label}: the build lets in ${built.inward} arrows against today's ${today.inward}`)
      if (weather !== 'summer') {
        assert.ok(built.total <= today.total, `${label}: the build draws ${built.total} arrows against today's ${today.total}`)
      }
    }
  }
}
console.log(`  tightest spacing by lane: ${[...tightest].map(([key, spacing]) => `${key} → ${spacing.toFixed(2)} m`).join(', ')}`)

// The Complete house shows its heat only outside, up to the faces it strikes; the open house keeps the lanes above.
assert.ok(insideHouse([0, 1, 0], 'pitched') && insideHouse([0, RIDGE_Y - 0.01, 0], 'pitched'), 'the rooms and the attic are inside the house')
assert.ok(!insideHouse([0, RIDGE_Y + 0.01, 0], 'pitched') && !insideHouse([0, 1, HOUSE.halfDepth + 0.01], 'pitched') && !insideHouse([-HOUSE.halfLength - 0.01, 1, 0], 'pitched') && !insideHouse([0, -0.1, 0], 'pitched'), 'over the ridge, past the walls or under the grade is outside')
assert.ok(insideHouse([0, LOW_SLOPE_DECK_Y - 0.01, 0], 'low-slope') && !insideHouse([0, LOW_SLOPE_DECK_Y + 0.01, 0], 'low-slope'), 'a flat roof\'s deck closes the house over')
assert.ok(HOME_COMPLETE_ROOF_HEAT_LANES.pitched.every(l => l.covering[2] > 0), 'on the Complete gable the sun lands on the near slope')
HOME_COMPLETE_ROOF_HEAT_LANES.pitched.forEach((lane, i) => near(lane.covering[1], ROOF_LANES[i].covering[1], 1e-9, 'the near slope\'s lanes land as high as the back slope\'s'))
const completeTightest = new Map<string, number>()
for (const form of ROOF_FORMS) {
  for (const weather of ['summer', 'winter'] as const) {
    for (const build of [false, true]) {
      const home = HOMES_BY_FORM[form]
      const label = `${form} ${weather} ${build ? 'build' : 'today'}`
      const completeLanes = homeHeatLanes(form, sceneHeat({ property: home.property, weather, ...(build ? { view: 'proposed', proposedScopeIds: home.build, efficiencyUpgrades: ['cool-roof'] } : {}) }), weather, 'complete', 'shingle', [])
      assert.ok(completeLanes.length > 0, `${label}: the Complete house draws heat`)
      for (const lane of completeLanes) {
        lane.points.forEach(p => assert.ok(!insideHouse(p, form), `${label}: no arrow on the Complete house goes inside it (${p.map(value => value.toFixed(2)).join(', ')})`))
        assert.ok(laneLength(lane) >= 2 * HEAT_ARROW_LOOK.size.home, `${label}: every outside lane is long enough to read as moving heat (${laneLength(lane).toFixed(2)} m)`)
        const key = `${form} ${laneLength(lane).toFixed(2)} m`
        completeTightest.set(key, Math.min(completeTightest.get(key) ?? Infinity, laneLength(lane) / lane.count))
      }
      const outsideLeg = (lane: CompleteWallLane) => weather === 'summer' ? [lane.outside, lane.face] as const : [lane.face, lane.outside] as const
      assert.equal(windowLanes(completeLanes).filter(lane => HOME_COMPLETE_WINDOW_HEAT_LANES.some(window => lane.points[0] === outsideLeg(window)[0] && lane.points[1] === outsideLeg(window)[1])).length, HOME_COMPLETE_WINDOW_HEAT_LANES.length, `${label}: one outside leg per window, the front's included`)
      assert.equal(COMPLETE_FACE_LANES.filter(lane => lanesFrom(completeLanes, ...outsideLeg(lane)).length === 1).length, 12, `${label}: an outside leg on every wall lane and every window`)
    }
  }
}
console.log(`  Complete tightest spacing by lane: ${[...completeTightest].map(([key, spacing]) => `${key} → ${spacing.toFixed(2)} m`).join(', ')}`)
const nearSlope = HOME_COMPLETE_ROOF_HEAT_LANES.pitched[0]
const winterRoof = homeHeatLanes('pitched', winterHeat, 'winter', 'complete', 'shingle', [])[0]
assert.deepEqual(winterRoof.points, [[nearSlope.covering[0], nearSlope.covering[1] + coveringStandoff('shingle'), nearSlope.covering[2]], nearSlope.sky], 'winter runs each lane outward: the roof lane starts on the covering')
const roofLaneEnd = (covering: string) => homeHeatLanes('pitched', summerHeat, 'summer', 'complete', covering, [])[0].points[1][1]
assert.ok(roofLaneEnd('tile') >= roofLaneEnd('shingle') + TILE.radius * 0.8, 'arrows on tile land on the crowns')
assert.ok(coveringStandoff('shingle') >= LANE_STANDOFF && coveringStandoff(null) === coveringStandoff('shingle'), 'a covering with no standoff of its own takes the shingles\'')
assert.deepEqual(homeHeatLanes('pitched', summerHeat, 'summer', 'partly-open', 'tile', []), summerLanes, 'the open house\'s lanes do not read the covering')

// A running fan blows the attic's heat out its gable in both views, whatever the season, for the fan only ever blows out.
const fanRunning = heatOf('inland', 'summer', { covering: 'shingle', ...FAN })
const fanIdle = barrierShake(true)
assert.ok(fanRunning.atticFanRunning && !fanIdle.atticFanRunning, 'one heat runs the fan and one idles it')
const fanLanes = (lanes: readonly ArrowLane[]) => lanesFrom(lanes, ATTIC_FAN_LANE.vent, ATTIC_FAN_LANE.outside)
near(ATTIC_FAN_LANE.vent[0], -HOUSE.halfLength + 0.5, 1e-9, 'the fan\'s lane starts half a metre inside the gable')
near(ATTIC_FAN_LANE.outside[0], -HOUSE.halfLength - 1.2, 1e-9, 'and ends 1.2 m out in the yard')
assert.deepEqual([ATTIC_FAN_LANE.vent[1], ATTIC_FAN_LANE.vent[2], ATTIC_FAN_LANE.outside[2]], [ATTIC_FAN_LANE.outside[1], 0, 0], 'the fan\'s lane runs level, straight out along x on the ridge line')
near(ATTIC_FAN_LANE.vent[1], homeGableVent(-1).backing.position[1], 1e-9, 'the fan\'s lane leaves at the left vent\'s height')
for (const view of HOME_VIEWS) {
  for (const season of ['summer', 'winter'] as const) {
    const all = homeHeatLanes('pitched', fanRunning, season, view, 'shingle', [])
    const lanes = fanLanes(all)
    assert.equal(lanes.length, 1, `${view} ${season}: a running fan draws one lane out the left vent`)
    assert.deepEqual(lanes[0], heatArrowLane([ATTIC_FAN_LANE.vent, ATTIC_FAN_LANE.outside], heatLaneFlows(fanRunning).roof[1]), `${view} ${season}: the fan's lane carries the attic's flow`)
    assert.deepEqual(all.filter(lane => !lanes.includes(lane)), homeHeatLanes('pitched', { ...fanRunning, atticFanRunning: false }, season, view, 'shingle', []), `${view} ${season}: the running fan only adds its lane`)
  }
  assert.equal(fanLanes(homeHeatLanes('pitched', fanIdle, 'summer', view, 'shingle', [])).length, 0, `${view}: an Idle fan draws no lane`)
}

// Every ceiling opening that leaks gets a short vertical lane at its own spot through the ceiling, in the open house over a
// pitched roof only: hot attic air down into the rooms in summer and on normal days, the rooms' heat up in winter.
const leaksAt = (lanes: readonly ArrowLane[], opening: CeilingOpening) => lanes.filter(lane => lane.points.length === 2 && lane.points.every(([x, , z]) => x === opening.at[0] && z === opening.at[1]))
const leakLanesIn = (lanes: readonly ArrowLane[]) => CEILING_OPENINGS.flatMap(opening => leaksAt(lanes, opening))
for (const [label, leaks] of [['leaks with ducts', ceilingOpenings(true)], ['leaks without ducts', ceilingOpenings(false)]] as const) {
  for (const [weather, season] of [['summer', 'summer'], ['normal', 'summer'], ['winter', 'winter']] as const) {
    const heat = sceneHeat({ weather })
    const lanes = homeHeatLanes('pitched', heat, season, 'partly-open', null, leaks)
    const leakLanes = leakLanesIn(lanes)
    assert.equal(leakLanes.length, leaks.length, `${label} ${weather}: one lane per opening`)
    for (const opening of leaks) {
      const at = leaksAt(leakLanes, opening)
      assert.equal(at.length, 1, `${label} ${weather}: the ${opening.kind} at ${opening.at.join(', ')} leaks once`)
      const [first, last] = at[0].points
      const [top, bottom] = [WALL_TOP_Y + CEILING_LEAK_LANE.above, WALL_TOP_Y - CEILING_LEAK_LANE.below]
      assert.deepEqual([first[1], last[1]], season === 'summer' ? [top, bottom] : [bottom, top], `${label} ${weather}: the ${opening.kind} leaks ${season === 'summer' ? 'down into the room' : 'up into the attic'}`)
      assert.equal(at[0].count, 2, `${label} ${weather}: two arrows a leak`)
      assert.ok(laneLength(at[0]) / at[0].count >= MIN_ARROW_SPACING, `${label} ${weather}: a leak's arrows read apart`)
    }
    assert.deepEqual(lanes.filter(lane => !leakLanes.includes(lane)), homeHeatLanes('pitched', heat, season, 'partly-open', null, []), `${label} ${weather}: the leaks only add lanes`)
    assert.equal(leakLanesIn(homeHeatLanes('pitched', heat, season, 'partly-open', null, [])).length, 0, `${weather}: nothing leaks when nothing is passed`)
    assert.equal(leakLanesIn(homeHeatLanes('pitched', heat, season, 'complete', 'shingle', leaks)).length, 0, `${label} ${weather}: the Complete house shows no leaks`)
    const flat = sceneHeat({ property: HOMES_BY_FORM['low-slope'].property, weather })
    assert.equal(leakLanesIn(homeHeatLanes('low-slope', flat, season, 'partly-open', null, leaks)).length, 0, `${label} ${weather}: a flat roof has no attic to leak into`)
  }
}

// Up close, the arrows cross the section layer by layer, counted from the same table as the whole home: the covering and the
// barrier turn some back, the insulation lets few through to the room, and the lanes ride the parts as they peel.
const KIT_MIN_ARROW_SPACING = 0.5 * HEAT_ARROW_LOOK.size.kit
const samePoint = (a: Vec3 | undefined, b: Vec3 | undefined) => a !== undefined && b !== undefined && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9
const KIT_HOMES = { gable: { property: shingleR11, roof: TEAR_OFF }, flat: { property: flatR11, roof: TORCH_DOWN } } as const
const kitTightest = new Map<string, number>()
const kitCounts: string[] = []
for (const [label, home] of Object.entries(KIT_HOMES)) {
  const kitScene = (weather: HeatWeather, build: boolean, climate: Climate = 'inland') => {
    const scene = resolveScene(inputs({ property: home.property, weather, climate, ...(build ? { view: 'proposed', proposedScopeIds: [home.roof, ATTIC_REPLACEMENT, RADIANT_BARRIER], efficiencyUpgrades: ['cool-roof'] } : {}) }), cuts)
    const target = roofAttic(scene)
    const heat = scene.heat
    const season: Season | null = seasonOf(weather)
    assert.ok(heat !== null && season !== null, `${label} ${weather}: the home has heat`)
    const form = homeRoofForm(target.form)
    const points = (peel: number) => {
      const spans = kitHeatSpans(form, target.parts, peel)
      const span = (id: string) => spans.find(candidate => candidate.partId === id)
      const covering = span('covering')
      const ceiling = span('ceiling')
      assert.ok(covering && ceiling, `${label}: the line crosses the covering and the ceiling`)
      const barrier = span('radiant-barrier')
      const deck = span('deck')
      assert.ok(deck, `${label}: the line crosses the deck`)
      return {
        sky: offsetBy(covering.outer, KIT_FLOW.sky[form]),
        covering: covering.outer,
        atticTop: (span('attic-insulation') ?? ceiling).outer,
        room: [ceiling.inner[0], ceiling.inner[1] - KIT_FLOW.room, ceiling.inner[2]] as Vec3,
        reflectedTo: offsetBy(covering.outer, KIT_FLOW.reflected[form]),
        barrier: barrier?.inner,
        barrierOuter: barrier?.outer,
        barrierTo: barrier && kitBarrierBounceEnd(form, barrier),
        deckUnderside: deck.inner,
      }
    }
    return { form, season, heat, points, lanes: (peel: number) => kitHeatLanes(form, target.parts, heat, season, peel) }
  }
  const roomLane = (lanes: readonly ArrowLane[], room: Vec3) => lanes.find(lane => samePoint(lane.points.at(-1), room) || samePoint(lane.points[0], room))

  const existingKit = kitScene('summer', false)
  const todayAt = existingKit.points(0)
  const todayLanes = existingKit.lanes(0)
  assert.ok(todayLanes.length > 0, `${label}: summer draws arrows up close`)
  assert.ok(samePoint(todayLanes[0].points[0], todayAt.sky), `${label}: summer's first lane starts in the sky`)
  assert.ok(samePoint(todayLanes[0].points.at(-1), todayAt.covering), `${label}: summer's first lane ends on the covering`)
  const isBounce = (lane: ArrowLane, at: typeof todayAt) => samePoint(lane.points.at(-1), at.reflectedTo) || samePoint(lane.points.at(-1), at.barrierTo)
  assert.ok(samePoint(todayLanes.filter(lane => !isBounce(lane, todayAt)).at(-1)?.points.at(-1), todayAt.room), `${label}: summer's last main lane ends in the room`)
  assert.deepEqual(kitHeatLanes(existingKit.form, [], existingKit.heat, existingKit.season, 0), [], `${label}: a section with no parts on the line draws no arrows`)
  assert.deepEqual(kitHeatSpans(existingKit.form, [], 0), [], `${label}: no parts, no spans`)
  assert.ok(todayLanes.every(lane => lane.count > 0), `${label}: a lane with no arrows is dropped`)

  const built = kitScene('summer', true)
  const builtAt = built.points(0)
  const builtLanes = built.lanes(0)
  assert.ok(builtLanes.some(lane => samePoint(lane.points[0], builtAt.covering) && samePoint(lane.points.at(-1), builtAt.reflectedTo)), `${label}: the cool covering turns arrows back`)
  if (label === 'gable') {
    assert.ok(builtLanes.some(lane => samePoint(lane.points[0], builtAt.barrier) && samePoint(lane.points.at(-1), builtAt.barrierTo)), `${label}: the barrier turns arrows back`)
    const toBarrier = builtLanes.find(lane => samePoint(lane.points[0], builtAt.covering) && samePoint(lane.points.at(-1), builtAt.barrierOuter))
    const pastBarrier = builtLanes.find(lane => samePoint(lane.points[0], builtAt.barrier) && !samePoint(lane.points.at(-1), builtAt.barrierTo))
    assert.ok(toBarrier && pastBarrier, `${label}: the build's lane through the roof stops at the barrier and starts again under it`)
    assert.ok(toBarrier.count > pastBarrier.count, `gable: the barrier visibly thins the arrows (${toBarrier.count} onto it, ${pastBarrier.count} past it)`)
  }
  else {
    // A radiant barrier is worked from inside an attic, so a flat roof's build never gets one.
    assert.equal(builtAt.barrier, undefined, `${label}: no radiant barrier goes in under a flat roof`)
  }
  const todayRoom = roomLane(todayLanes, todayAt.room)?.count ?? 0
  const builtRoom = roomLane(builtLanes, builtAt.room)?.count ?? 0
  assert.ok(builtRoom < todayRoom, `${label}: the build lets fewer arrows into the room up close (${builtRoom} vs ${todayRoom})`)

  const winter = kitScene('winter', false)
  const winterAt = winter.points(0)
  const winterLanes = winter.lanes(0)
  assert.ok(samePoint(winterLanes[0]?.points[0], winterAt.room), `${label}: winter's first lane starts in the room`)
  assert.ok(winterLanes.some(lane => samePoint(lane.points.at(-1), winterAt.sky)), `${label}: winter's heat leaves through the covering to the sky`)
  const winterBuilt = kitScene('winter', true)
  const winterBuiltAt = winterBuilt.points(0)
  assert.ok(!winterBuilt.lanes(0).some(lane => samePoint(lane.points.at(-1), winterBuiltAt.reflectedTo) || samePoint(lane.points.at(-1), winterBuiltAt.barrierTo)), `${label}: winter bounces nothing`)

  const coveringPeel = KIT_PEEL[existingKit.form].covering
  const peeled = existingKit.lanes(1)[0].points
  todayLanes[0].points.forEach((point, index) => {
    point.forEach((value, axis) => near(peeled[index][axis] - value, coveringPeel[axis], 1e-9, `${label}: the covering's lane rides the covering's peel`))
  })
  // An inner layer moves by its own peel, not the covering's, so the arrows ride each layer apart.
  const builtPeeledAt = built.points(1)
  const peeledParts = [['radiant-barrier', builtAt.barrier, builtPeeledAt.barrier], ['deck', builtAt.deckUnderside, builtPeeledAt.deckUnderside]] as const
  for (const [partId, rest, lifted] of peeledParts.filter(([partId]) => label === 'gable' || partId !== 'radiant-barrier')) {
    assert.ok(rest && lifted, `${label}: the build's line crosses the ${partId}`)
    const partPeel = KIT_PEEL[built.form][partId]
    assert.ok(partPeel && partPeel.some((value, axis) => Math.abs(value - coveringPeel[axis]) > 1e-6), `${label}: the ${partId} peels apart from the covering`)
    rest.forEach((value, axis) => near(lifted[axis] - value, partPeel[axis], 1e-9, `${label}: the ${partId}'s point rides the ${partId}'s peel`))
  }
  if (label === 'gable') {
    const pastBarrierPeeled = built.lanes(1).find(lane => samePoint(lane.points[0], builtPeeledAt.barrier) && !samePoint(lane.points.at(-1), builtPeeledAt.barrierTo))
    assert.ok(pastBarrierPeeled, `${label}: peeled, the lane past the barrier starts on the barrier where it has peeled to`)
  }

  for (const climate of CLIMATES) {
    for (const weather of HEAT_WEATHERS) {
      const [todayCount, builtCount] = [false, true].map((build) => {
        const kit = kitScene(weather, build, climate)
        const ends = (lane: ArrowLane, point: Vec3 | undefined) => samePoint(lane.points[0], point) || samePoint(lane.points.at(-1), point)
        for (const peel of [0, 1]) {
          const at = kit.points(peel)
          const role = (lane: ArrowLane) => ends(lane, at.reflectedTo)
            ? 'covering bounce'
            : ends(lane, at.barrierTo) ? 'barrier bounce' : ends(lane, at.sky) ? 'sky' : ends(lane, at.room) ? 'room' : ends(lane, at.barrierOuter) ? 'onto the barrier' : ends(lane, at.barrier) ? 'past the barrier' : 'through the roof'
          if (at.barrierTo) {
            // The barrier turns heat back toward the deck, never out through the roof over it.
            const { up } = roofAxes(kit.form)
            const overDeck = (at.barrierTo[0] - at.deckUnderside[0]) * up[0] + (at.barrierTo[1] - at.deckUnderside[1]) * up[1]
            assert.ok(overDeck < 0, `${label} ${climate} ${weather} build peel ${peel}: the barrier's bounce ends ${overDeck.toFixed(3)} m off the deck's underside`)
          }
          for (const lane of kit.lanes(peel)) {
            const spacing = laneLength(lane) / lane.count
            assert.ok(spacing >= KIT_MIN_ARROW_SPACING, `${label} ${climate} ${weather} ${build ? 'build' : 'today'} peel ${peel}: the ${role(lane)} lane of ${laneLength(lane).toFixed(2)} m holds ${lane.count} arrows, ${spacing.toFixed(2)} m apart`)
            const key = `${label} ${role(lane)} peel ${peel}`
            kitTightest.set(key, Math.min(kitTightest.get(key) ?? Infinity, spacing))
          }
        }
        const lanes = kit.lanes(0)
        const at = kit.points(0)
        if (climate === 'inland' && weather !== 'normal') {
          kitCounts.push(`${label} ${weather} ${build ? 'build' : 'today'} [${lanes.map(lane => lane.count).join(', ')}]`)
        }
        // The section and the whole home agree where the roof's flow is held: into the attic, and through the ceiling.
        const intoAttic = lanes.find(lane => ends(lane, at.atticTop) && !ends(lane, at.room))?.count ?? 0
        const throughCeiling = lanes.find(lane => ends(lane, at.atticTop) && ends(lane, at.room))?.count ?? 0
        const homeLanes = homeHeatLanes(kit.form, kit.heat, kit.season, 'partly-open', null, [])
        const homeLeg = (outer: (roof: RoofHeatLane) => Vec3, inner: (roof: RoofHeatLane) => Vec3) =>
          HOME_ROOF_HEAT_LANES[kit.form].map(roof => lanesFrom(homeLanes, ...(kit.season === 'summer' ? [outer(roof), inner(roof)] as const : [inner(roof), outer(roof)] as const))[0]?.count ?? 0)
        const what = `${label} ${climate} ${weather} ${build ? 'build' : 'today'}`
        assert.deepEqual(homeLeg(roof => roof.covering, roof => roof.atticFloor), [intoAttic, intoAttic, intoAttic], `${what}: up close ${intoAttic} arrows cross into the attic, as on every roof lane of the whole home`)
        assert.deepEqual(homeLeg(roof => roof.atticFloor, roof => roof.room), [throughCeiling, throughCeiling, throughCeiling], `${what}: up close ${throughCeiling} arrows cross the ceiling, as on every roof lane of the whole home`)
        return roomLane(lanes, at.room)?.count ?? 0
      })
      const strict = label === 'gable' && weather === 'summer'
      assert.ok(strict ? builtCount < todayCount : builtCount <= todayCount, `${label} ${climate} ${weather}: up close the build lets ${builtCount} arrows into the room against today's ${todayCount}`)
    }
  }
}
console.log(`  kit arrows (inland, lanes in order): ${kitCounts.join('; ')}`)
console.log(`  kit tightest spacing: ${[...kitTightest].map(([key, spacing]) => `${key} → ${spacing.toFixed(2)} m`).join(', ')}`)

// The thermal paint and the ghost pass only rescan when the tree changes, so the watcher must see a change at any depth,
// including inside a branch that joined after it started, and a pass over an unchanged tree must change nothing.
const watchedRoot = new Group()
const watchedBranch = new Group()
watchedRoot.add(watchedBranch)
let treeChanges = 0
const unwatchTree = watchSubtree(watchedRoot, () => treeChanges++)
const joined = new Group()
watchedBranch.add(joined)
joined.add(new Group())
watchedBranch.remove(joined)
joined.add(new Group())
assert.equal(treeChanges, 3, 'the watcher sees an object join or leave at any depth, and lets a branch go when it leaves')
unwatchTree()
watchedBranch.add(new Group())
assert.equal(treeChanges, 3, 'unwatched, the tree changes unseen')

const paintedHome = new Group()
paintedHome.userData = { thermalZone: 'roof' }
const roofMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
paintedHome.add(roofMesh)
const homePaint = createThermalPaintSet(Object.fromEntries(HOME_PAINT_KEYS.map(key => [key, 0.5])) as Record<HomePaintKey, number>)
assert.equal(paintThermal(paintedHome, homePaint, new Set()), true, 'the first pass paints the home')
assert.equal(paintThermal(paintedHome, homePaint, new Set()), false, 'a pass over an unchanged home changes nothing')
const rebuilt = new MeshStandardMaterial()
roofMesh.material = rebuilt
assert.equal(paintThermal(paintedHome, homePaint, new Set()), true, 'a material rebuilt under the camera is painted over')
restoreThermalPaint(homePaint)
assert.equal(roofMesh.material, rebuilt, 'the rebuilt material, not the first, is what the mesh gets back')

// A home view or a foundation fades only its own parts, and the thermal camera's shared paint must not carry that fade
// onto the rest of the house.
const fadeMesh = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial())
const scene = new Group()
const exterior = new Group()
exterior.userData = thermalTag('exterior')
const root = new Group()
const completeGroup = new Group()
completeGroup.userData = HOME_FADE_TAGS.complete
const raisedGroup = new Group()
raisedGroup.userData = HOME_FADE_TAGS.raised
const front = fadeMesh()
const nested = fadeMesh()
const back = fadeMesh()
const backTwin = fadeMesh()
scene.add(exterior)
exterior.add(root)
root.add(completeGroup, back, backTwin)
completeGroup.add(front, raisedGroup)
raisedGroup.add(nested)
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'a part of the Complete house takes its fade')
assert.equal(front.material.transparent, true, 'a faded part draws see-through')
assert.equal(front.material.depthWrite, false, 'below half it stops writing depth')
assert.equal(back.material.opacity, 1, 'the rest of the house keeps its opacity')
assert.equal(back.material.transparent, false, 'and stays solid')
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0 })
assert.equal(front.visible, false, 'a part faded all the way out costs no draw')
applyGhost(root, 0.15)
near(front.material.opacity, 0.15, 1e-9, 'with no levels, the ghost is today\'s ghost')
assert.equal(front.visible, true, 'and the part is drawn again')
applyGhost(root, 0.5, { ...HOME_FADES_SHOWN, complete: 0.4, raised: 0.5 })
near(nested.material.opacity, 0.1, 1e-9, 'fades multiply with the ghost')
// A subtree woken later still finds the fade tags above it.
applyGhost(front, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'fade tags are read up to the scene, not only inside the root')
// The guard the home's scan uses: a settled Partly open still needs its fade on a late mount or a repaint.
assert.equal(homeFadeNeeded(1, HOME_FADES_SHOWN), false, 'a whole house at full strength needs no pass')
assert.equal(homeFadeNeeded(1, { ...HOME_FADES_SHOWN, complete: 0 }), true, 'a settled Partly open does')
assert.equal(homeFadeNeeded(0.15, HOME_FADES_SHOWN), true, 'and so does the ghost')
const late = fadeMesh()
completeGroup.add(late)
applyGhost(late, 1, { ...HOME_FADES_SHOWN, complete: 0 })
assert.equal(late.visible, false, 'a part mounted after the house opened stays hidden')
const fadedPaint = createThermalPaintSet(Object.fromEntries(HOME_PAINT_KEYS.map(key => [key, 0.5])) as Record<HomePaintKey, number>)
paintThermal(scene, fadedPaint, new Set())
assert.notEqual(front.material, back.material, 'a part of the Complete house gets its own paint, so fading it leaves the back walls alone')
assert.equal(backTwin.material, back.material, 'two parts with the same zone and no fade still share one paint')
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'fade survives a repaint')
assert.equal(back.material.opacity, 1, 'the back wall\'s paint stays solid')
restoreThermalPaint(fadedPaint)
// The yard reads outside air like the house's walls, but the house's ghost must not dim it up close.
const yardScene = new Group()
const yardGroup = new Group()
yardGroup.userData = thermalTag('exterior')
const yardMesh = fadeMesh()
yardGroup.add(yardMesh)
const ghostedHouse = new Group()
ghostedHouse.userData = { ...thermalTag('exterior'), ...HOME_GHOST_TAG }
const houseWall = fadeMesh()
ghostedHouse.add(houseWall)
yardScene.add(yardGroup, ghostedHouse)
const yardPaint = createThermalPaintSet(Object.fromEntries(HOME_PAINT_KEYS.map(key => [key, 0.5])) as Record<HomePaintKey, number>)
paintThermal(yardScene, yardPaint, new Set())
assert.notEqual(yardMesh.material, houseWall.material, 'the yard gets its own paint, apart from the ghosted house\'s walls')
applyGhost(ghostedHouse, HOME_GHOST_OPACITY)
near(houseWall.material.opacity, HOME_GHOST_OPACITY, 1e-9, 'the house\'s walls take the ghost')
assert.equal(yardMesh.material.opacity, 1, 'and the yard stays at full strength')
restoreThermalPaint(yardPaint)

assert.equal(homeFloorY(null), HOME_FLOOR_Y.slab, 'an unknown foundation draws as slab')
assert.equal(homeFloorY('slab'), 0.15, 'a slab floor sits just above grade')
assert.equal(homeFloorY('raised'), 0.75, 'a raised floor sits up over its crawl space')
assert.ok(HOME_FLOOR_Y.raised - HOUSE.floorThickness - FOUNDATION.joistDepth >= 0.4572, 'at least 18 in under the joists')
assert.ok(HOME_FLOOR_Y.raised / FRONT_STEPS.risers <= 0.196, 'no riser taller than 7 3/4 in')
const lifted = liftedFraming({ position: [1, 2, 3], target: [4, 5, 6], fov: 35 }, 0.3)
assert.deepEqual(lifted, { position: [1, 2.3, 3], target: [4, 5.3, 6], fov: 35 }, 'the zoom rises with the house')
const lift = new Group()
const liftedHouse = new Group()
const ground = new Group()
lift.add(liftedHouse)
liftedHouse.add(ground)
applyHomeFloor(lift, ground, HOME_FLOOR_Y.raised)
near(lift.position.y + ground.position.y, 0, 1e-9, 'the ground frame stays on the ground')
near(lift.position.y + ground.position.y + ground.scale.y * (HOUSE.floorY - HOUSE.floorThickness), HOME_FLOOR_Y.raised - HOUSE.floorThickness, 1e-9, 'and reaches the floor\'s underside')
const raisedLift = HOME_FLOOR_Y.raised - HOUSE.floorY
const bottomOf = (boxes: readonly BoxSpec[]) => Math.min(...boxes.map(b => b.position[1] - b.size[1] / 2))
const topOf = (boxes: readonly BoxSpec[]) => Math.max(...boxes.map(b => b.position[1] + b.size[1] / 2))
for (const form of ROOF_FORMS) {
  assert.ok(bottomOf(downspoutBoxes(form)) + raisedLift <= 1e-9, 'the downspouts reach the ground on a raised floor')
}
const girders = FLOOR_FRAMING.filter(b => b.size[0] > b.size[2])
near(topOf(PIERS), bottomOf(girders), 1e-9, 'the piers meet the girders')
near(bottomOf(PIERS) + raisedLift, 0, 1e-9, 'and stand on the ground on a raised floor')
for (const box of FLOOR_FRAMING) {
  assert.ok(Math.abs(box.position[0]) + box.size[0] / 2 <= HOUSE.halfLength - HOUSE.wallThickness + 1e-9, 'the floor framing stops inside the side foundation walls')
  assert.ok(Math.abs(box.position[2]) + box.size[2] / 2 <= HOUSE.halfDepth - HOUSE.wallThickness + 1e-9, 'and inside the front and back ones')
}

near(FRONT_WALL.line + HOUSE.wallThickness / 2, HOUSE.halfDepth + FRONT_WALL_PROUD, 1e-9, 'the front wall stands just proud of the cut face')
assert.equal(FRONT_WALL.outward, 1)
const frontOpenings = [...FRONT_OPENINGS].sort((a, b) => a.along - b.along)
frontOpenings.forEach(o => assert.ok(o.along - o.width / 2 >= FRONT_WALL.from && o.along + o.width / 2 <= FRONT_WALL.to, 'every front opening fits its wall'))
frontOpenings.slice(1).forEach((o, i) => assert.ok(o.along - o.width / 2 - (frontOpenings[i].along + frontOpenings[i].width / 2) >= 0.3, 'front openings keep a pier between them'))
assert.equal(FRONT_DOOR.sill, 0, 'the door opens at the floor')
assert.ok(!(Object.values(HOUSE_WALLS) as unknown[]).includes(FRONT_WALL), 'the open house never draws the front wall')

const risingRoot = new Group()
const risingPart = new Group()
risingPart.userData = HOME_FADE_TAGS.complete
const stayingPart = new Group()
const stretchedFrame = new Group()
stretchedFrame.scale.y = 1.7
const stretchedPart = new Group()
stretchedPart.userData = HOME_FADE_TAGS.complete
stretchedFrame.add(stretchedPart)
risingRoot.add(risingPart, stayingPart, stretchedFrame)
riseFadeGroup(risingRoot, 'complete', 0.3)
near(risingPart.position.y, 0.3, 1e-9, 'a part of the Complete house rises as it fades')
assert.equal(stayingPart.position.y, 0, 'an untagged part stays put')
risingRoot.updateMatrixWorld(true)
near(stretchedPart.getWorldPosition(new Vector3()).y, risingPart.getWorldPosition(new Vector3()).y, 1e-9, 'a part in the stretched ground frame rises as far as the rest')

// The near slope's two parts lay their covering on one grid, so no joint runs eave to ridge at the cut.
const slopeArea = { seed: 7, wear: WEAR_AMOUNT.worn, xFrom: COVERING_EAVE_X, xTo: SLOPE_LENGTH, zFrom: -ROOF_HALF_LENGTH, zTo: ROOF_HALF_LENGTH, base: COVERING_BASE }
const wholeShingles = layoutShingles(slopeArea, SHINGLE)
const leftShingles = piecesInSpan(wholeShingles, -ROOF_HALF_LENGTH, HOUSE.cutX, true)
const rightShingles = piecesInSpan(wholeShingles, HOUSE.cutX, ROOF_HALF_LENGTH, true)
const widthOf = (pieces: readonly { width: number }[]) => pieces.reduce((sum, piece) => sum + piece.width, 0)
near(widthOf(leftShingles) + widthOf(rightShingles), widthOf(wholeShingles), 1e-9, 'the two parts together lay every tab of the whole slope')
assert.ok(leftShingles.every(p => p.z + p.width / 2 <= HOUSE.cutX + 1e-9) && rightShingles.every(p => p.z - p.width / 2 >= HOUSE.cutX - 1e-9), 'and each stops at the cut')
const { pans: wholePans } = layoutTiles(slopeArea, TILE)
near(piecesInSpan(wholePans, -ROOF_HALF_LENGTH, HOUSE.cutX, false).length + piecesInSpan(wholePans, HOUSE.cutX, ROOF_HALF_LENGTH, false).length, wholePans.length, 0, 'every tile goes to one part, whole')

// No rafter shows through the roof. In a slope's own frame every rafter stays under the deck and its ends stay on the
// ridge's plane and the eave's; the fascia hangs outside the tails and the deck's edge, hides each tail's cut end, and its
// top never rises through the covering laid over it.
const { pitch: PITCH } = HOUSE
const across = ([x, y]: readonly [number, number]) => x * Math.cos(PITCH) - y * Math.sin(PITCH)
const upward = ([x, y]: readonly [number, number]) => x * Math.sin(PITCH) + y * Math.cos(PITCH)
assert.ok(RAFTER_PROFILE.every(([, y]) => y <= 1e-9), 'no rafter rises above the deck\'s underside')
const rafterReach = Math.max(...RAFTER_PROFILE.map(across))
assert.ok(rafterReach <= HOUSE.halfDepth + 1e-9, `a rafter reaches ${(rafterReach - HOUSE.halfDepth).toFixed(4)} m past the ridge`)
assert.ok(RAFTER_PROFILE.every(point => across(point) >= -HOUSE.eaveOverhang - 1e-9), 'nor past the eave')
const { thickness: FASCIA_T, height: FASCIA_H } = ROOF_TRIM.fascia
const fasciaOuter = across(FASCIA_CENTRE) - FASCIA_T / 2
const eaveEnds: (readonly [number, number])[] = [...RAFTER_PROFILE, [-EAVE_RUN, 0], [-EAVE_RUN, COVERING_BASE]]
const outThroughFascia = Math.max(...eaveEnds.map(point => fasciaOuter - across(point)))
assert.ok(outThroughFascia <= 1e-9, `the eave's ends poke ${outThroughFascia.toFixed(4)} m out through the fascia`)
const tailBottom = Math.min(...RAFTER_PROFILE.filter(point => across(point) < HOUSE.halfDepth / 2).map(upward))
assert.ok(upward(FASCIA_CENTRE) - FASCIA_H / 2 <= tailBottom + 1e-9, 'the fascia hides each tail\'s cut end')
function fasciaTop(side: 1 | -1): readonly [number, number] {
  return [
    FASCIA_CENTRE[0] + (FASCIA_H / 2) * Math.sin(PITCH) + side * (FASCIA_T / 2) * Math.cos(PITCH),
    FASCIA_CENTRE[1] + (FASCIA_H / 2) * Math.cos(PITCH) - side * (FASCIA_T / 2) * Math.sin(PITCH),
  ]
}
// The top edge runs from its inner corner out past the covering's first course; only the part under the covering counts.
const [topIn, topOut] = [fasciaTop(1), fasciaTop(-1)]
const atCoveringEdge = topOut[1] + (topIn[1] - topOut[1]) * (COVERING_EAVE_X - topOut[0]) / (topIn[0] - topOut[0])
assert.ok(Math.max(topIn[1], topOut[0] < COVERING_EAVE_X ? atCoveringEdge : topOut[1]) <= COVERING_BASE + 1e-9, 'the fascia\'s top stays under the covering')

// The first course reaches out over the gutter's back lip, so no gap between roof and gutter shows from above.
const coveringEdge = -across([COVERING_EAVE_X, COVERING_BASE])
assert.ok(coveringEdge >= GUTTER_BACK - 1e-9, `the covering stops ${(GUTTER_BACK - coveringEdge).toFixed(3)} m short of the gutter`)

// Nothing in the attic pokes through the roof: the plenum stays under the rafters, the ducts it feeds start on it and stay
// under the deck, and every blanket of insulation stays under the roof's underside wherever it is laid.
const underRafters = (z: number) => roofUndersideY(z, 'pitched') - HOUSE.rafterDepth / Math.cos(PITCH)
const { position: [plenumX, plenumY, plenumZ], size: [plenumW, plenumH, plenumD] } = EQUIPMENT.plenum
for (const z of [plenumZ - plenumD / 2, plenumZ + plenumD / 2]) {
  const over = plenumY + plenumH / 2 - underRafters(z)
  assert.ok(over <= 1e-9, `the plenum's top stands ${over.toFixed(3)} m over the rafters' underside at z ${z.toFixed(2)}`)
}
for (const run of EQUIPMENT.ductRuns) {
  const [x, y, z] = run[0]
  assert.ok(Math.abs(x - plenumX) <= plenumW / 2 + 1e-9 && Math.abs(y - plenumY) <= plenumH / 2 + 1e-9 && Math.abs(z - plenumZ) <= plenumD / 2 + 1e-9, 'each duct run starts on the plenum')
  run.forEach(([, py, pz]) => assert.ok(py + EQUIPMENT.ductRadius <= roofUndersideY(pz, 'pitched') + 1e-9, `a duct rises through the roof at z ${pz}`))
}
for (const material of Object.keys(INSULATION_DEPTH)) {
  for (const form of ROOF_FORMS) {
    for (const span of Object.values(ATTIC_SPANS)) {
      for (const { size, position } of atticInsulationBoxes(material, form === 'low-slope', span)) {
        const top = position[1] + size[1] / 2
        const over = Math.max(...[position[2] - size[2] / 2, position[2] + size[2] / 2].map(z => top - roofUndersideY(z, form)))
        assert.ok(over <= 1e-9, `${material} under a ${form} roof rises ${over.toFixed(3)} m through it`)
      }
    }
    const [leakX, leakZ] = LEAK.spot
    const overLeak = atticInsulationBoxes(material, form === 'low-slope', leakZ < 0 ? ATTIC_SPANS.open : ATTIC_SPANS.complete)
      .filter(({ size, position }) => Math.abs(leakX - position[0]) <= size[0] / 2 && Math.abs(leakZ - position[2]) <= size[2] / 2)
    near(atticInsulationTop(material, form === 'low-slope', leakZ), Math.max(...overLeak.map(({ size, position }) => position[1] + size[1] / 2)), 1e-9, `the leak soaks down from ${material}'s top`)
  }
}

const kitPart = new Group()
const kitMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
const kitOwn = kitMesh.material
kitPart.add(kitMesh)
const kitPaint = createKitPartPaint(0.2, 0.8)
assert.equal(paintKitPart(kitPart, kitPaint), true, 'the first pass paints the part')
assert.equal(paintKitPart(kitPart, kitPaint), false, 'a pass over an unchanged part changes nothing')
kitPart.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
assert.equal(paintKitPart(kitPart, kitPaint), true, 'a mesh that joins the part is painted')
kitPart.remove(kitPart.children[1])
paintKitPart(kitPart, kitPaint)
assert.equal(kitPaint.meshes.size, 1, 'a mesh gone from the part is let go')
restoreKitPart(kitPaint)
assert.equal(kitMesh.material, kitOwn, 'the part gets back what it wore')

// Every part draws its wear as an amount: the build's new parts at 0, a kept part by its set wear, an unset one as Worn.
const wearPart = (condition: ResolvedPart['condition'], wear?: Wear): ResolvedPart[] => [{ id: 'covering', group: 'roof', role: 'surface', material: 'shingle', condition, label: '', detail: '', thermal: null, water: null, ...(wear ? { wear } : {}) }]
assert.equal(partState(wearPart('installed', 'failing'), 'covering').wear, 0, 'the build always draws new')
assert.equal(partState(wearPart('worn'), 'covering').wear, 0.75, 'unset reads as Worn')
assert.equal(partState(wearPart('retained', 'new'), 'covering').wear, 0)
assert.equal(partState(wearPart('worn', 'failing'), 'covering').wear, 1)
assert.equal(partState([], 'covering').wear, 0, 'an absent part draws new')

const shingleAreaAt = (wear: number) => ({ ...slopeArea, wear })
const tabCount = (wear: number) => layoutShingles(shingleAreaAt(wear), SHINGLE).length
assert.ok(tabCount(WEAR_AMOUNT.new) > tabCount(WEAR_AMOUNT.worn) && tabCount(WEAR_AMOUNT.worn) > tabCount(WEAR_AMOUNT.failing), 'more tabs go missing as the wear grows')
const liftedCount = (wear: number) => layoutShingles(shingleAreaAt(wear), SHINGLE).filter(piece => piece.tilt < -0.2).length
assert.equal(liftedCount(WEAR_AMOUNT.new), 0, 'a new roof has no lifted tab')
assert.ok(liftedCount(WEAR_AMOUNT.failing) > liftedCount(WEAR_AMOUNT.worn) && liftedCount(WEAR_AMOUNT.worn) > 0, 'more tabs lift as the wear grows')

assert.equal(wornColor('#000000', '#808080', 0), '#000000', 'no wear is the fresh colour')
assert.equal(wornColor('#000000', '#808080', WEAR_AMOUNT.worn), '#808080', 'Worn is the worn colour')
const lightnessOf = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l
assert.ok(lightnessOf(wornColor('#808080', '#c0c0c0', WEAR_AMOUNT.failing)) > lightnessOf('#c0c0c0'), 'Failing goes further from fresh than Worn')
assert.ok(lightnessOf(wornColor('#f3ece0', '#a39a8c', WEAR_AMOUNT.failing)) < lightnessOf('#a39a8c'), 'a darkening look keeps darkening at Failing')
const hueOf = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).h
near(hueOf(wornColor('#f3ece0', '#a39a8c', WEAR_AMOUNT.failing)), hueOf('#a39a8c'), 0.01, 'Failing keeps the worn tone\'s hue')
assert.equal(wornColor('#f0f0f0', '#ffffff', WEAR_AMOUNT.failing), '#ffffff', 'a channel past white stays white')

// Every home material, scope and upgrade row is registered: a label, real parts, an install and a verb.
for (const id of HOME_MATERIAL_IDS) {
  assert.ok(HOME_SCENE_COPY.HOME_MATERIAL_LABELS[id], `${id} has a label`)
  for (const { assembly, part } of HOME_MATERIALS[id].parts) {
    assert.ok(ASSEMBLIES[assembly].parts.some(candidate => candidate.id === part), `${id}: ${assembly} has ${part}`)
  }
}
for (const scopeId of Object.values(SCOPE_IDS)) {
  assert.ok(SCOPE_INSTALLS[scopeId], `${scopeId} installs something`)
  assert.ok((SCOPE_VERBS as Record<string, unknown>)[scopeId], `${scopeId} has a verb`)
}
assert.ok(HOME_SYSTEMS.flatMap(system => system.rows).every(row => ASSEMBLIES[row.assembly].parts.some(part => part.id === row.part)), 'every system row is a real part')

// The copy that lives in core is held to the same rule as the copy file; appliesTo and ids are predicates, not copy.
const coreCopy: [string, string][] = []
function takeCopy(path: string, copy: { label: string, detail: string } | undefined) {
  if (copy) {
    coreCopy.push([`${path}.label`, copy.label], [`${path}.detail`, copy.detail])
  }
}
for (const assembly of Object.values(ASSEMBLIES)) {
  for (const part of assembly.parts) {
    const partPath = `${assembly.id}.${part.id}`
    takeCopy(`${partPath}.absentCopy`, part.absentCopy)
    for (const [materialId, material] of Object.entries(part.materials)) {
      const path = `${partPath}.${materialId}`
      takeCopy(`${path}.copy`, material.copy)
      takeCopy(`${path}.needsBase.copy`, material.needsBase?.copy)
      for (const [condition, copy] of Object.entries(material.conditionCopy ?? {})) {
        takeCopy(`${path}.conditionCopy.${condition}`, copy)
      }
    }
  }
}
for (const shingle of OWENS_CORNING_SHINGLES) {
  coreCopy.push([`OWENS_CORNING_SHINGLES.${shingle.id}`, shingle.name])
}
assert.ok(coreCopy.length > 50, 'the core copy walk reaches the parts and shingles')
for (const [path, line] of coreCopy) {
  assert.ok(!/\byour\b/i.test(line), `${path}: no "your" (${line})`)
  assert.ok(!/solar/i.test(line), `${path}: never solar (${line})`)
}

// Every framing the app can glide to keeps its target inside the pan box, so a glide never fights the clamp. The yard and
// under-floor anchors have no kit, and the slab crawl framing is never used, so neither is checked.
assert.equal(homeLift('slab'), HOME_FLOOR_Y.slab - HOUSE.floorY, 'the slab lift is the floor height above the drawn floor')
assert.equal(homeLift('raised'), HOME_FLOOR_Y.raised - HOUSE.floorY, 'the raised lift is the floor height above the drawn floor')
assert.equal(homeLift(null), HOME_FLOOR_Y.slab - HOUSE.floorY, 'an unknown foundation lifts as a slab')
function inPanBox(box: { min: readonly number[], max: readonly number[] }, point: readonly number[], label: string) {
  const outside = [0, 1, 2].filter(axis => point[axis] < box.min[axis] - 1e-9 || point[axis] > box.max[axis] + 1e-9)
  assert.deepEqual(outside, [], `${label}: [${point.map(value => value.toFixed(2)).join(', ')}] lies inside the pan box [${box.min.map(value => value.toFixed(2)).join(', ')}] .. [${box.max.map(value => value.toFixed(2)).join(', ')}]`)
}
const roofAtticParts = ASSEMBLIES['roof-attic'].parts.flatMap(part => part.id === 'attic-insulation'
  ? [null, ...Object.keys(part.materials)].map(material => ({ id: part.id, material }))
  : [{ id: part.id, material: Object.keys(part.materials)[0] ?? null }])
assert.ok(roofAtticParts.filter(part => part.id === 'attic-insulation').length > 2, 'the pan check walks every insulation material')
for (const foundation of ['slab', 'raised'] as const) {
  const lift = homeLift(foundation)
  const box = homePanBox(lift)
  assert.equal(box.min[1], 0, `${foundation}: the pan box stands on the ground`)
  inPanBox(box, HOME_ANCHORS.pitched.yard.position, `${foundation}: the yard anchor`)
  inPanBox(box, HOME_FRAMINGS.wide.target, `${foundation}: the wide home framing`)
  inPanBox(box, HOME_FRAMINGS.tall.target, `${foundation}: the tall home framing`)
  if (foundation === 'raised') {
    inPanBox(box, liftedFraming(HOME_ANCHORS.pitched['under-floor'].framing, lift).target, `${foundation}: the crawl framing`)
  }
  for (const form of ROOF_FORMS) {
    for (const kit of Object.values(ASSEMBLY_KITS)) {
      const framing = liftedFraming(HOME_ANCHORS[form][kit.anchor].framing, lift)
      inPanBox(box, framing.target, `${foundation} ${form}: the ${kit.anchor} framing`)
      if (!kit.partFocus) {
        continue
      }
      let leans = 0
      for (const part of roofAtticParts) {
        for (const peel of [0, 0.5, 1]) {
          const offset = kit.partFocus(form, part, peel)
          if (offset) {
            leans += 1
            inPanBox(box, framingTowardPart(framing, offset).target, `${foundation} ${form}: the lean toward ${part.id} (${part.material}) at peel ${peel}`)
          }
        }
      }
      assert.ok(leans > 20, `${foundation} ${form}: the pan check reaches the part leans (${leans})`)
    }
  }
}
assert.ok(homePanBox(0).max[2] > HOME_ANCHORS.pitched.yard.position[2], 'the box reaches past the yard anchor in front')

// One paint look: the cracks keep their seeds, stay in their band and under the rake, and leave with their parapet.
{
  const spec = { wall: HOUSE_WALLS.back, face: HOUSE.wallThickness / 2, floorY: HOUSE.floorY, top: WALL_TOP_Y, perWall: 8, seed: 11, share: 4 / 3 }
  const plain = stuccoCracks(spec)
  assert.equal(plain.length, 21, 'the wall cracks keep their count')
  assert.deepEqual(plain[0], { size: [0.011, 0.27809289408847687, 0.004], position: [1.345474869495129, 1.607710282912295, -4.002], rotation: [0, 0, -1.6272249136880397] }, 'the wall cracks keep their seeds')
  const lighter = stuccoCracks({ ...spec, share: 0.5 })
  assert.ok(lighter.length > 0, 'a Light level still draws cracks')
  assert.ok(lighter.every(box => plain.some(each => isDeepStrictEqual(each, box))), 'every Light crack is one of the Heavy cracks, in place')
  assert.equal(stuccoCracks({ ...spec, share: 0 }).length, 0, 'None draws no cracks')
  const banded = stuccoCracks({ ...spec, band: [3, 3.6] })
  assert.ok(banded.length > 0, 'a band still draws cracks')
  for (const box of banded) {
    assert.ok(box.position[1] >= 3 && box.position[1] <= 3.6, `a banded crack's centre ${box.position[1]} stays in the band`)
  }
  for (const [side, list] of Object.entries(gableCracks(4 / 3))) {
    assert.ok(list.length > 0, `the ${side} gable has cracks at Failing`)
    for (const box of list) {
      const [, length] = box.size
      assert.ok(box.position[1] > WALL_TOP_Y, `a ${side} gable crack sits above the wall top`)
      assert.ok(box.position[1] + length / 2 < roofUndersideY(box.position[2], 'pitched'), `a ${side} gable crack stays under the rake`)
    }
  }
  const parapets = parapetCracks(4 / 3)
  assert.ok(parapets.complete.length > 0 && parapets.kept.length > 0, 'both parapet lists have cracks at Failing')
  for (const box of parapets.kept) {
    assert.ok(Math.abs(box.position[2] - FRONT_WALL.line) > 0.2, 'no kept parapet crack lies on the front wall')
    if (box.position[0] < 0) {
      assert.ok(box.position[2] <= 0, 'a kept crack on the left parapet lies in its back half')
    }
  }
  assert.equal(parapetCracks(0).kept.length + parapetCracks(0).complete.length, 0, 'Cracks at None leave the parapets clean')
  assert.equal(paintLook({ material: 'cool', wear: 0 }, PAINT_WEAR_START.worn).color, HOME_PALETTE.paintCool)
  assert.equal(paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn).wear, 0.75)
  assert.deepEqual(paintLook({ material: 'standard', wear: 0 }, { cracks: 'heavy', stains: 'heavy', peeling: 'heavy' }).paintWear, { cracks: 'none', stains: 'none', peeling: 'none' }, 'new or installed paint shows no paint wear, whatever was recorded')
  assert.deepEqual(paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn).paintWear, PAINT_WEAR_START.worn, 'worn paint shows the levels it is given')
}

// The front cracks keep off the door. Seed 5, the house's own, never reaches it, so this seed's last crack runs onto the door
// when the door is left out, and the check can fail.
{
  // stuccoCracks' opening margin.
  const margin = 0.25
  const ends = (box: BoxSpec) => {
    const tilt = box.rotation?.[2] ?? 0
    const half = box.size[1] / 2
    return [-1, 1].map(sign => [box.position[0] - sign * Math.sin(tilt) * half, box.position[1] + sign * Math.cos(tilt) * half] as const)
  }
  const onDoor = (box: BoxSpec) => ends(box).some(([along, height]) => Math.abs(along - FRONT_DOOR.along) <= FRONT_DOOR.width / 2 + margin
    && height >= HOUSE.floorY + FRONT_DOOR.sill - margin && height <= HOUSE.floorY + FRONT_DOOR.head + margin)
  const spec = { wall: FRONT_WALL, face: HOUSE.wallThickness / 2, floorY: HOUSE.floorY, top: WALL_TOP_Y, perWall: WEAR_LOOKS.paint.crackCount, seed: 9, share: PAINT_WEAR_SHARE.heavy }
  const doorless = stuccoCracks(spec)
  const kept = stuccoCracks({ ...spec, openings: FRONT_OPENINGS })
  assert.ok(doorless.some(onDoor), 'without the door, a front crack runs onto it')
  assert.ok(!kept.some(onDoor), 'given the door, no front crack reaches it')
  assert.deepEqual(kept, doorless.slice(0, kept.length), 'the cracks before the one the door stops are unchanged')
  assert.ok(doorless.slice(kept.length).every(onDoor), 'and only the boxes on the door go')
  assert.match(readFileSync('src/features/trade-scenes/ui/components/home-kit/house-shell.tsx', 'utf8'), /crack\(FRONT_WALL, \d+, FRONT_OPENINGS\)/, 'the house gives its front cracks the door')
}

// The foundation walls: every opening but the door is a drawn crawl vent, carried into the ground frame at the raised floor,
// and a crack laid out through the stretch keeps its real size and stays off the vents.
{
  const lift = HOME_FLOOR_Y.raised - HOUSE.floorY
  const underFloor = HOUSE.floorY - HOUSE.floorThickness
  near(FOUNDATION_FRONT_WALL.line + HOUSE.wallThickness / 2, HOUSE.halfDepth, 1e-9, 'the front foundation wall\'s face is the skirt\'s')
  const walls = [...Object.values(FOUNDATION_WALLS).map(wall => [wall, CRAWL_VENT_BOXES] as const), [FOUNDATION_FRONT_WALL, FRONT_CRAWL_VENT_BOXES] as const]
  let vents = 0
  for (const [wall, boxes] of walls) {
    const [along, across] = wall.run === 'x' ? [0, 2] : [2, 0]
    for (const opening of wall.openings.filter(each => each !== FRONT_DOOR)) {
      const on = boxes.filter(box => Math.abs(box.position[along] - opening.along) < 1e-9 && Math.abs(box.size[along] - opening.width) < 1e-9
        && (box.position[across] - wall.line) * wall.outward > 0
        && Math.abs((box.position[1] - box.size[1] / 2 + lift) - opening.sill * RAISED_GROUND_STRETCH) < 1e-9
        && Math.abs((box.position[1] + box.size[1] / 2 + lift) - opening.head * RAISED_GROUND_STRETCH) < 1e-9)
      assert.equal(on.length, 1, `the foundation opening at ${opening.along} sits on one drawn vent`)
      vents++
    }
  }
  assert.equal(vents, CRAWL_VENT_BOXES.length + FRONT_CRAWL_VENT_BOXES.length, 'every drawn vent is an opening on its foundation wall')
  assert.ok(FOUNDATION_FRONT_WALL.openings.includes(FRONT_DOOR), 'the front foundation wall keeps its cracks off the door too')
  // A mark may run to its wall's ends, so each wall's run stays on its own skirt box: past it, a side mark would reach onto the
  // front skirt's end, which leaves with the Complete house.
  const skirts = [...Object.entries(FOUNDATION_WALLS).map(([side, wall]) => [side, wall, CRAWL_SKIRT_BOXES] as const), ['front', FOUNDATION_FRONT_WALL, FRONT_CRAWL_SKIRT_BOXES] as const]
  for (const [side, wall, boxes] of skirts) {
    const [along, across] = wall.run === 'x' ? [0, 2] : [2, 0]
    const own = boxes.filter(box => Math.abs(box.position[across] - wall.line) < 1e-9)
    assert.equal(own.length, 1, `the ${side} foundation wall stands on one skirt box`)
    const [box] = own
    const [start, end] = [box.position[along] - box.size[along] / 2, box.position[along] + box.size[along] / 2]
    assert.ok(wall.from >= start - 1e-9 && wall.to <= end + 1e-9, `the ${side} foundation wall's run ${wall.from}..${wall.to} stays on its skirt box ${start}..${end}`)
  }

  const wall = FOUNDATION_WALLS.back
  const cracks = stuccoCracks({ wall, face: HOUSE.wallThickness / 2, floorY: 0, top: underFloor, perWall: 16, seed: 61, share: 4 / 3, band: [0, underFloor], stretch: RAISED_GROUND_STRETCH })
  assert.ok(cracks.length > 0, 'the back foundation wall cracks')
  for (const box of cracks) {
    const tilt = box.rotation?.[2] ?? 0
    const half = box.size[1] / 2
    const [from, to] = [-1, 1].map(sign => [box.position[0] - sign * Math.sin(tilt) * half, (box.position[1] + sign * Math.cos(tilt) * half) * RAISED_GROUND_STRETCH] as const)
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    assert.ok(length > 0.16 - 1e-9 && length < 0.3 + 1e-9, `a foundation crack reads ${length.toFixed(3)} m long through the stretch`)
    for (const [x, y] of [from, to]) {
      assert.ok(y >= -1e-9 && y <= underFloor * RAISED_GROUND_STRETCH + 1e-9, 'a foundation crack stays between grade and the floor')
      assert.ok(wall.openings.every(vent => Math.abs(x - vent.along) > vent.width / 2 || y < vent.sill * RAISED_GROUND_STRETCH || y > vent.head * RAISED_GROUND_STRETCH), 'a foundation crack stays off the vents')
    }
  }
}

// Stains keep off every opening, the door and the crawl vents included; a higher level keeps every stain a lower one placed and
// adds to them; each lies flat on its own wall's face; streaks hang from under a sill; and each window's sill top carries dirt.
{
  const face = HOUSE.wallThickness / 2
  const underFloor = HOUSE.floorY - HOUSE.floorThickness
  const surfaces = [
    ...Object.entries(HOUSE_WALLS).map(([label, wall]) => ({ label, wall: wall as HouseWall, openings: wall.openings, floorY: HOUSE.floorY, base: underFloor, top: WALL_TOP_Y, stretch: 1 })),
    { label: 'front', wall: FRONT_WALL, openings: FRONT_OPENINGS, floorY: HOUSE.floorY, base: underFloor, top: WALL_TOP_Y, stretch: 1 },
    ...[...Object.entries(FOUNDATION_WALLS), ['front', FOUNDATION_FRONT_WALL] as const].map(([label, wall]) => ({ label: `${label} foundation`, wall, openings: wall.openings, floorY: 0, base: 0, top: underFloor, stretch: RAISED_GROUND_STRETCH })),
  ]
  const placed = { splash: 0, streaks: 0, blotches: 0 }
  for (const [index, { label, wall, openings, floorY, base, top, stretch }] of surfaces.entries()) {
    const [along, across] = wall.run === 'x' ? [0, 2] : [2, 0]
    const line = wall.line + wall.outward * face
    const place = {
      splash: (share: number) => splashBand(wall, base, share, openings, stretch),
      streaks: (share: number) => runoffStreaks(wall, floorY, top, share, 21 + index, openings),
      blotches: (share: number) => fadeBlotches(wall, floorY, top, share, 31 + index, index % 2 === 0, openings, stretch),
    }
    for (const [kind, at] of Object.entries(place) as [keyof typeof place, (share: number) => BoxSpec[]][]) {
      assert.deepEqual(at(0), [], `${label} wall: ${kind} at None places nothing`)
      const moderate = at(1)
      const heavy = at(4 / 3)
      assert.deepEqual(moderate, heavy.slice(0, moderate.length), `${label} wall: Moderate's ${kind} are Heavy's first ones, in place`)
      placed[kind] += heavy.length
      for (const share of [0.5, 1, 4 / 3]) {
        for (const box of at(share)) {
          const [start, end] = [box.position[along] - box.size[along] / 2, box.position[along] + box.size[along] / 2]
          const [bottom, height] = [box.position[1] - box.size[1] / 2, box.position[1] + box.size[1] / 2]
          assert.ok(box.size[along] > 0 && box.size[1] > 0, `${label} wall: a ${kind} box has a width and a height`)
          assert.equal(box.size[across], 0, `${label} wall: a ${kind} box is flat`)
          assert.equal(box.rotation, undefined, `${label} wall: a ${kind} box stands square`)
          near(box.position[across], line, 0.01, `${label} wall: a ${kind} box lies on its wall's face`)
          for (const opening of openings) {
            const apart = end <= opening.along - opening.width / 2 + 1e-9 || start >= opening.along + opening.width / 2 - 1e-9
              || height <= floorY + opening.sill + 1e-9 || bottom >= floorY + opening.head - 1e-9
            assert.ok(apart, `${label} wall: ${kind} at share ${share.toFixed(2)} (${start.toFixed(2)}..${end.toFixed(2)}, ${bottom.toFixed(2)}..${height.toFixed(2)}) keeps off the opening at ${opening.along}`)
          }
          if (kind === 'streaks') {
            for (const opening of openings.filter(each => each.sill > 0)) {
              const under = start < opening.along + opening.width / 2 && end > opening.along - opening.width / 2 && bottom < floorY + opening.head
              assert.ok(!under || height <= floorY + opening.sill + 1e-9, `${label} wall: a streak under the opening at ${opening.along} hangs from its sill`)
            }
          }
        }
      }
      if (kind === 'streaks') {
        for (const opening of openings.filter(each => each.sill > 0)) {
          const hung = moderate.some(box => Math.abs(box.position[along] - opening.along) < opening.width / 2
            && box.position[1] + box.size[1] / 2 <= floorY + opening.sill && box.position[1] + box.size[1] / 2 > floorY + opening.sill - 0.05)
          assert.ok(hung, `${label} wall: at Moderate the opening at ${opening.along} has a streak hanging from just under its sill`)
        }
      }
    }
  }
  for (const [kind, count] of Object.entries(placed)) {
    assert.ok(count > 0, `Heavy places ${kind} (${count})`)
  }
  // On the stretched foundation wall the band is laid out at its drawn height divided by the stretch, so it reads its real height.
  const band = splashBand(FOUNDATION_WALLS.back, 0, 1, [], RAISED_GROUND_STRETCH)
  const house = splashBand(HOUSE_WALLS.back, underFloor, 1, [])
  assert.deepEqual(band.map(box => box.size[1] * RAISED_GROUND_STRETCH).map(height => height.toFixed(9)), house.map(box => box.size[1].toFixed(9)), 'the foundation\'s band reads the house wall\'s heights through the stretch')

  for (const wall of [...Object.values(HOUSE_WALLS) as HouseWall[], FRONT_WALL]) {
    const windows = wall.openings.filter(opening => opening.sill > 0)
    const dirt = sillDirt(wall, HOUSE.floorY, HOUSE.wallThickness, 1)
    assert.deepEqual(sillDirt(wall, HOUSE.floorY, HOUSE.wallThickness, 0), [], 'clean stains leave the sills clean')
    assert.equal(dirt.length, windows.length, 'one layer of dirt per window sill')
    for (const [index, opening] of windows.entries()) {
      const ledge = sillLedgeBox(wall, opening, HOUSE.floorY, HOUSE.wallThickness)
      assert.deepEqual(windowBoxes(wall, opening, WINDOW_FRAMES.single, HOUSE.floorY, HOUSE.wallThickness).frames[4], ledge, 'the window draws the sill ledge the dirt lies on')
      const layer = dirt[index]
      assert.ok(layer.size[1] > 0, 'the dirt has a thickness')
      near(layer.position[1] - layer.size[1] / 2, ledge.position[1] + ledge.size[1] / 2, 1e-9, 'the dirt lies on the ledge\'s top')
      for (const axis of [0, 2] as const) {
        near(layer.position[axis], ledge.position[axis], 1e-9, 'the dirt sits over the ledge')
        near(layer.size[axis], ledge.size[axis], 1e-9, 'the dirt covers the ledge\'s top')
      }
    }
  }

  // Each stain list takes its own atlas cell and its own strength in the colour's fourth channel; plants keep three channels.
  const geometry = mergeStainBoxes([
    { cell: 'splash', boxes: splashBand(HOUSE_WALLS.back, underFloor, 1), color: '#806040', alpha: 0.5 },
    { cell: 'blotch', boxes: [], color: '#ffffff', alpha: 1 },
    { cell: 'streak', boxes: runoffStreaks(HOUSE_WALLS.back, HOUSE.floorY, WALL_TOP_Y, 1, 21), color: '#906040', alpha: 0.25 },
  ])
  assert.ok(geometry, 'stains merge into one geometry')
  const color = geometry.getAttribute('color')
  const uv = geometry.getAttribute('uv')
  assert.equal(color.itemSize, 4, 'a stain carries its strength as the colour\'s fourth channel')
  const alphas = new Set(Array.from({ length: color.count }, (_, vertex) => color.getW(vertex)))
  assert.deepEqual([...alphas].sort(), [0.25, 0.5], 'each list draws at its own strength')
  for (let vertex = 0; vertex < uv.count; vertex++) {
    const [from, to] = color.getW(vertex) === 0.5 ? STAIN_CELL_U.splash : STAIN_CELL_U.streak
    assert.ok(uv.getX(vertex) >= from - 1e-6 && uv.getX(vertex) <= to + 1e-6, 'a stain\'s UVs stay inside its own atlas cell')
  }
  geometry.dispose()
  assert.equal(mergeStainBoxes([{ cell: 'splash', boxes: [], color: '#806040', alpha: 1 }]), null, 'nothing to draw merges to nothing')
  const plant = tintVertices(new BoxGeometry(1, 1, 1), '#40a040', 0.2, 3)
  assert.equal(plant.getAttribute('color').itemSize, 3, 'a plant keeps a three-channel colour')
  plant.dispose()
}

// Peeling: None places nothing, and a higher level keeps every patch and flake a lower one placed. On a wall it keeps off every
// opening, the door included, stays by the foot, under a sill or at an end, and even Heavy bares only a small share of the wall,
// never whole sheets. The door frame's lies on the frame, low on the jambs or along the outside edges, and the fascia's on its face.
{
  const face = HOUSE.wallThickness / 2
  const underFloor = HOUSE.floorY - HOUSE.floorThickness
  const reach = 0.6
  const shares = [0.5, 1, 4 / 3]
  const empty = { bare: [], lifted: [] }
  // A flake leans, so its reach on each axis is its turned box's.
  const extent = (box: BoxSpec, axis: 0 | 1 | 2): readonly [number, number] => {
    const turn = new Euler(...(box.rotation ?? [0, 0, 0]))
    const corner = (x: number, y: number, z: number) => new Vector3(x * box.size[0] / 2, y * box.size[1] / 2, z * box.size[2] / 2).applyEuler(turn).getComponent(axis)
    const reaches = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => corner(x, y, z))))
    return [box.position[axis] + Math.min(...reaches), box.position[axis] + Math.max(...reaches)]
  }
  const prefix = (label: string, at: (share: number) => { bare: BoxSpec[], lifted: BoxSpec[] }) => {
    assert.deepEqual(at(0), empty, `${label}: Peeling at None places nothing`)
    assert.ok(at(4 / 3).bare.length > at(0.5).bare.length, `${label}: Heavy bares more than Light`)
    for (const [lower, higher] of [[0.5, 1], [1, 4 / 3]]) {
      const [low, high] = [at(lower), at(higher)]
      for (const list of ['bare', 'lifted'] as const) {
        assert.deepEqual(low[list], high[list].slice(0, low[list].length), `${label}: share ${lower.toFixed(2)}'s ${list} boxes are share ${higher.toFixed(2)}'s first ones, in place`)
      }
    }
  }
  // On the wall lines and with the seeds house-shell and foundation draw them with: each wall runs out over the corner it meets.
  // Two more seeds each, since the rules hold for any.
  const sides = ['back', 'left', 'right'] as const
  const surfaces = [
    ...sides.map(side => ({ label: side, wall: (HOUSE_WALLS[side].run === 'z' ? { ...HOUSE_WALLS[side], from: -HOUSE.halfDepth } : HOUSE_WALLS[side]) as HouseWall, openings: HOUSE_WALLS[side].openings, floorY: HOUSE.floorY, bottom: underFloor, top: WALL_TOP_Y, stretch: 1, seed: PEELING_SEEDS.house[side] })),
    { label: 'front', wall: { ...FRONT_WALL, from: -HOUSE.halfLength, to: HOUSE.halfLength }, openings: FRONT_OPENINGS, floorY: HOUSE.floorY, bottom: underFloor, top: WALL_TOP_Y, stretch: 1, seed: PEELING_SEEDS.house.front },
    ...([
      ['back', FOUNDATION_WALLS.back],
      ['left', { ...FOUNDATION_WALLS.left, from: -HOUSE.halfDepth }],
      ['right', { ...FOUNDATION_WALLS.right, from: -HOUSE.halfDepth }],
      ['front', { ...FOUNDATION_FRONT_WALL, from: -HOUSE.halfLength, to: HOUSE.halfLength }],
    ] as const).map(([label, wall]) => ({ label: `${label} foundation`, wall: wall as HouseWall, openings: wall.openings, floorY: 0, bottom: 0, top: underFloor, stretch: RAISED_GROUND_STRETCH, seed: PEELING_SEEDS.foundation[label] })),
  ]
  let flakes = 0
  for (const { label, wall, openings, floorY, bottom, top, stretch, seed: drawn } of surfaces) {
    const [along, across] = wall.run === 'x' ? [0, 2] as const : [2, 0] as const
    const real = (y: number) => (y - bottom) * stretch
    for (const seed of [drawn, 7, 1234]) {
      const at = (share: number) => wallPeeling(wall, floorY, bottom, share, seed, openings, stretch, top)
      prefix(`${label} wall, seed ${seed}`, at)
      const heavy = at(4 / 3)
      flakes += heavy.lifted.length
      assert.ok(heavy.bare.length > 0, `${label} wall: Heavy peels`)
      // The bare area counts each centimetre once, since a cluster's patches overlap.
      const columns = Math.ceil((wall.to - wall.from) * 100)
      const cells = new Uint8Array(columns * Math.ceil(real(top) * 100))
      for (const box of heavy.bare) {
        const [start, end] = extent(box, along)
        const [low, high] = extent(box, 1)
        for (let row = Math.round(real(low) * 100); row < Math.round(real(high) * 100); row++) {
          cells.fill(1, row * columns + Math.round((start - wall.from) * 100), row * columns + Math.round((end - wall.from) * 100))
        }
      }
      const bared = cells.reduce((sum, cell) => sum + cell, 0) / cells.length
      assert.ok(bared < 0.02, `${label} wall, seed ${seed}: Heavy bares ${(bared * 100).toFixed(2)}% of the wall, under 2%`)
      for (const share of shares) {
        const placed = at(share)
        for (const [list, boxes] of Object.entries(placed)) {
          for (const box of boxes) {
            const [[start, end], [low, high]] = [extent(box, along), extent(box, 1)]
            const where = `${label} wall, seed ${seed}, share ${share.toFixed(2)}: a ${list} box (${start.toFixed(2)}..${end.toFixed(2)}, ${low.toFixed(3)}..${high.toFixed(3)})`
            assert.ok(start >= wall.from - 1e-9 && end <= wall.to + 1e-9 && low >= bottom - 1e-9 && high <= top + 1e-9, `${where} stays on the wall`)
            const proud = (box.position[across] - wall.line) * wall.outward - face
            assert.ok(proud > 0 && proud < 0.02, `${where} lies just proud of the wall's face (${proud.toFixed(4)})`)
            if (list === 'bare') {
              assert.equal(box.rotation, undefined, `${where} lies flat`)
            }
            for (const opening of openings) {
              const apart = end <= opening.along - opening.width / 2 + 1e-9 || start >= opening.along + opening.width / 2 - 1e-9
                || high <= floorY + opening.sill + 1e-9 || low >= floorY + opening.head - 1e-9
              assert.ok(apart, `${where} keeps off the opening at ${opening.along}`)
            }
            const byFoot = real(low) <= reach + 1e-9
            const byEnd = start - wall.from <= reach + 1e-9 || wall.to - end <= reach + 1e-9
            const bySill = openings.some(opening => opening.sill > 0
              && end > opening.along - opening.width / 2 - reach && start < opening.along + opening.width / 2 + reach
              && real(high) <= real(floorY + opening.sill) + 1e-9 && real(floorY + opening.sill) - real(high) <= reach)
            assert.ok(byFoot || byEnd || bySill, `${where} lies within ${reach} m of the wall's foot, a sill's underside or an end`)
          }
        }
      }
    }
  }
  assert.ok(flakes > 0, 'Heavy lifts flakes on the walls')

  const frame = FRONT_DOOR_BOXES.frame
  for (const seed of [PEELING_SEEDS.door, 3]) {
    prefix(`door frame, seed ${seed}`, share => doorFramePeeling(share, seed))
    for (const share of shares) {
      const { bare, lifted } = doorFramePeeling(share, seed)
      for (const jamb of frame.slice(0, 2)) {
        const foot = bare.filter(box => Math.abs(box.position[0] - jamb.position[0]) < jamb.size[0] / 2 && box.position[1] - box.size[1] / 2 <= HOUSE.floorY + 1e-9)
        assert.ok(foot.length > 0, `door frame, share ${share.toFixed(2)}: the jamb at ${jamb.position[0].toFixed(2)} peels at its foot`)
        const reachUp = Math.max(...foot.map(box => box.position[1] + box.size[1] / 2)) - HOUSE.floorY
        assert.ok(reachUp >= 0.3 - 1e-9 && reachUp <= 0.4 + 1e-9, `door frame: a jamb's foot peels ${reachUp.toFixed(3)} m up, 30 to 40 cm`)
      }
      for (const box of [...bare, ...lifted]) {
        // Every turned corner stays on one frame box's face; the centre stands just proud of it.
        const on = frame.filter(each => ([0, 1] as const).every((axis) => {
          const [low, high] = extent(box, axis)
          return low >= each.position[axis] - each.size[axis] / 2 - 1e-9 && high <= each.position[axis] + each.size[axis] / 2 + 1e-9
        }) && box.position[2] > each.position[2] + each.size[2] / 2 && box.position[2] < each.position[2] + each.size[2] / 2 + 0.02)
        assert.ok(on.length > 0, `door frame, share ${share.toFixed(2)}: a peeling box at ${box.position.map(value => value.toFixed(3)).join(', ')} lies on the frame's face`)
      }
    }
  }

  const { height, thickness } = ROOF_TRIM.fascia
  // The back slope's one run and the near slope's two parts, with the seeds the roof draws them with.
  const fascias = [
    [[-ROOF_HALF_LENGTH, ROOF_HALF_LENGTH], PEELING_SEEDS.fascia.back],
    [[-ROOF_HALF_LENGTH, HOUSE.cutX], PEELING_SEEDS.fascia.front],
    [[HOUSE.cutX, ROOF_HALF_LENGTH], PEELING_SEEDS.fascia.front],
  ] as const
  for (const [run, drawn] of fascias) {
    for (const seed of [drawn, 7]) {
      prefix(`fascia ${run.join('..')}, seed ${seed}`, share => fasciaPeeling(run, share, seed))
      for (const box of Object.values(fasciaPeeling(run, 4 / 3, seed)).flat()) {
        const [[start, end], [low, high]] = [extent(box, 2), extent(box, 1)]
        const where = `fascia ${run.join('..')}, seed ${seed}: a peeling box (${start.toFixed(3)}..${end.toFixed(3)}, ${low.toFixed(3)}..${high.toFixed(3)})`
        assert.ok(start >= run[0] - 1e-9 && end <= run[1] + 1e-9, `${where} stays on its run`)
        assert.ok(low >= -height / 2 - 1e-9 && high <= height / 2 + 1e-9, `${where} stays on the board's height`)
        assert.ok(box.position[0] < -thickness / 2 && box.position[0] > -thickness / 2 - 0.02, `${where} lies on the board's outer face`)
      }
    }
  }
  assert.match(readFileSync('src/features/trade-scenes/ui/components/home-kit/house-shell.tsx', 'utf8'), /wallPeeling\(FRONT_STAIN_WALL, [^)]*FRONT_OPENINGS\)/, 'the house gives its front wall\'s peeling the door')
}

// The walls close: each wall's stucco is one solid with a hole where each opening's frame sits, every face of it points out of
// the solid, and the side skins wrap the back and front corners.
{
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5
  const bottom = HOUSE.floorY - HOUSE.floorThickness
  const skins = [
    { label: 'front', wall: FRONT_WALL, from: FRONT_WALL.from, offset: 0, thickness: HOUSE.wallThickness, openings: FRONT_OPENINGS },
    ...Object.entries(HOUSE_WALLS).map(([label, wall]) => ({ label, wall: wall as HouseWall, from: wall.run === 'z' ? SIDE_SKIN_FROM : wall.from, offset: HOUSE.paintThickness / 2, thickness: HOUSE.wallThickness - HOUSE.paintThickness, openings: wall.openings })),
  ]
  for (const { label, wall, from, offset, thickness, openings } of skins) {
    const geometry = wallSkinGeometry(wall, { from, to: wall.to, offset, thickness, bottom, top: WALL_TOP_Y, floorY: HOUSE.floorY }, openings)
    const position = geometry.getAttribute('position')
    const shading = geometry.getAttribute('normal')
    assert.equal(geometry.index, null, `${label} wall: the skin comes unindexed`)
    // A point in the wall's own terms: along its run, up, and across it toward the outside.
    const inWall = (point: Vector3) => wall.run === 'x'
      ? { along: point.x, up: point.y, out: (point.z - wall.line) * wall.outward }
      : { along: point.z, up: point.y, out: (point.x - wall.line) * wall.outward }
    const holes = openings.map(opening => ({ along: [opening.along - opening.width / 2, opening.along + opening.width / 2], up: [HOUSE.floorY + opening.sill, HOUSE.floorY + opening.head] }))
    const outFace = offset + thickness / 2
    const inFace = offset - thickness / 2
    const solid = ({ along, up, out }: ReturnType<typeof inWall>) => out > inFace && out < outFace && along > from && along < wall.to && up > bottom && up < WALL_TOP_Y
      && !holes.some(hole => along > hole.along[0] && along < hole.along[1] && up > hole.up[0] && up < hole.up[1])
    const [a, b, c, face, smooth] = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()]
    let outsideArea = 0
    for (let vertex = 0; vertex < position.count; vertex += 3) {
      a.fromBufferAttribute(position, vertex)
      b.fromBufferAttribute(position, vertex + 1)
      c.fromBufferAttribute(position, vertex + 2)
      face.subVectors(b, a).cross(c.clone().sub(a))
      const area = face.length() / 2
      if (area < 1e-10) {
        continue
      }
      face.normalize()
      const centre = a.clone().add(b).add(c).divideScalar(3)
      assert.ok(solid(inWall(centre.clone().addScaledVector(face, -1e-4))) && !solid(inWall(centre.clone().addScaledVector(face, 1e-4))), `${label} wall: triangle ${vertex / 3} faces out of the solid`)
      assert.ok(smooth.fromBufferAttribute(shading, vertex).dot(face) > 0.99, `${label} wall: triangle ${vertex / 3} shades the way it faces`)
      if ((wall.run === 'x' ? face.z : face.x) * wall.outward > 0.999) {
        outsideArea += area
      }
    }
    const holeArea = holes.reduce((sum, hole) => sum + (hole.along[1] - hole.along[0]) * (hole.up[1] - hole.up[0]), 0)
    assert.ok(Math.abs(outsideArea - ((wall.to - from) * (WALL_TOP_Y - bottom) - holeArea)) < 1e-4, `${label} wall: the outside face covers the slice minus its openings (${outsideArea})`)
    const points = Array.from({ length: position.count }, (_, vertex) => inWall(new Vector3().fromBufferAttribute(position, vertex)))
    for (const [index, opening] of openings.entries()) {
      const hole = holes[index]
      const rim = points.filter(point => point.along > hole.along[0] - 1e-4 && point.along < hole.along[1] + 1e-4 && point.up > hole.up[0] - 1e-4 && point.up < hole.up[1] + 1e-4)
      const span = (values: number[]) => [Math.min(...values), Math.max(...values)]
      const [along, up, out] = [span(rim.map(point => point.along)), span(rim.map(point => point.up)), span(rim.map(point => point.out))]
      assert.ok(near(out[0], inFace) && near(out[1], outFace), `${label} wall: the hole at ${opening.along} runs through the wall`)
      // The frames are placed by `wallBox` in the world, so a skin mirrored along its run would miss them.
      const frameBars = opening === FRONT_DOOR ? [] : windowBoxes(wall, opening, WINDOW_FRAMES.single, HOUSE.floorY, HOUSE.wallThickness).frames.slice(0, 4)
      const expected = frameBars.length > 0
        ? frameBars.flatMap(box => [-1, 1].map(end => inWall(new Vector3(...box.position).addScaledVector(new Vector3(...box.size), end / 2))))
        : [{ along: hole.along[0], up: hole.up[0] }, { along: hole.along[1], up: hole.up[1] }]
      const [frameAlong, frameUp] = [span(expected.map(point => point.along)), span(expected.map(point => point.up))]
      assert.ok(near(along[0], frameAlong[0]) && near(along[1], frameAlong[1]) && near(up[0], frameUp[0]) && near(up[1], frameUp[1]), `${label} wall: the hole at ${opening.along} sits where its frame does (${along} ${up} vs ${frameAlong} ${frameUp})`)
    }
    geometry.dispose()
  }
  assert.equal(SIDE_SKIN_FROM, BACK_INNER - HOUSE.paintThickness, 'the side skins start at the back wall\'s outer skin')
  assert.ok(readFileSync(join('src/features/trade-scenes/ui/components/home-kit/house-shell.tsx'), 'utf8').includes('SIDE_SKIN_FROM'), 'the house shell starts the side skins there')
  assert.equal(FRONT_CORNERS.length, 4, 'two boxes close each front corner')
  for (const side of [-1, 1]) {
    const corner = FRONT_CORNERS.filter(box => Math.sign(box.position[0]) === side)
    const reach = (axis: 0 | 1 | 2, end: -1 | 1) => Math.max(...corner.map(box => end * (box.position[axis] + end * box.size[axis] / 2))) * end
    assert.equal(corner.length, 2, `the ${side < 0 ? 'left' : 'right'} front corner has two boxes`)
    assert.ok(near(reach(2, 1), HOUSE.halfDepth + FRONT_WALL_PROUD) && near(reach(2, -1), HOUSE.halfDepth), `the ${side < 0 ? 'left' : 'right'} front corner runs from the side wall's end to the front wall's face`)
    assert.ok(near(Math.abs(reach(0, side as -1 | 1)), HOUSE.halfLength) && near(Math.abs(reach(0, -side as -1 | 1)), HOUSE.halfLength - HOUSE.wallThickness), `the ${side < 0 ? 'left' : 'right'} front corner spans the wall to the front wall's end`)
    assert.ok(near(reach(1, -1), bottom) && near(reach(1, 1), WALL_TOP_Y), `the ${side < 0 ? 'left' : 'right'} front corner runs the wall's height`)
  }
}

// The flat roof's fascia stops just short of each end, at the right parapet's outer face and the kitchen deck's cut end: an
// end in the plane of a deck, membrane or parapet face flickers against it. It still closes the edge from end to end.
{
  const roof = lowSlopeRoofBoxes()
  const xFaces = (box: BoxSpec) => [box.position[0] - box.size[0] / 2, box.position[0] + box.size[0] / 2]
  const faces = [roof.deck, roof.membrane, roof.completeDeck, roof.completeMembrane, roof.parapets, roof.completeParapets, roof.parapetCorners].flat().flatMap(xFaces)
  const clear = 0.001
  const reach = 0.005
  assert.equal(roof.frontFascia.length, 1, 'the flat roof has one front fascia')
  const [from, to] = xFaces(roof.frontFascia[0])
  for (const end of [from, to]) {
    for (const face of faces) {
      assert.ok(Math.abs(end - face) >= clear, `the fascia's end at x ${end.toFixed(4)} stops ${clear} clear of a deck, membrane or parapet face at x ${face.toFixed(4)}`)
    }
  }
  assert.ok(from > HOUSE.cutX && from - HOUSE.cutX <= reach, 'the fascia starts just past the kitchen deck\'s cut end')
  assert.ok(to < HOUSE.halfLength && HOUSE.halfLength - to <= reach, 'the fascia runs to just short of the right parapet\'s outer face')
}

{
  const reach = (box: BoxSpec, axis: 0 | 1 | 2, end: -1 | 1) => box.position[axis] + end * box.size[axis] / 2
  const clear = 0.001
  const closeTo = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-9
  const span = (box: BoxSpec) => [reach(box, 2, -1), reach(box, 2, 1)]
  const xs = ATTIC_JOIST_XS
  const flat = atticJoistBoxes(true)
  const kitchen = (box: BoxSpec) => box.position[0] > HOUSE.cutX
  assert.equal(flat.open.length, xs.length, 'every joist is drawn in the open house')
  assert.deepEqual(flat.complete.map(box => box.position[0]), xs.filter(x => x <= HOUSE.cutX), 'Complete adds only the joists the kitchen run does not already carry')
  for (const box of [...flat.open, ...flat.complete]) {
    assert.ok(reach(box, 1, 1) <= LOW_SLOPE_DECK_Y - clear, `a flat roof's joist top stops ${clear} under the deck's underside, where it would flicker against it`)
    assert.ok(reach(box, 2, 1) <= HOUSE.halfDepth - clear, 'a flat roof\'s joist stops short of the plane of the deck\'s and fascia\'s front face')
    assert.ok(closeTo(reach(box, 1, -1), WALL_TOP_Y), 'a joist stands on the wall tops')
  }
  for (const box of flat.open.filter(kitchen)) {
    assert.ok(closeTo(span(box)[0], BACK_INNER) && closeTo(span(box)[1], HOUSE.halfDepth - JOIST_DECK_GAP), 'a kitchen joist runs from the back wall to the front, short of its plane')
  }
  for (const box of flat.open.filter(box => !kitchen(box))) {
    assert.ok(closeTo(span(box)[0], ATTIC_SPANS.open.from) && closeTo(span(box)[1], ATTIC_SPANS.open.to), 'the other open joists stop at the cut')
  }
  for (const box of flat.complete) {
    assert.ok(closeTo(span(box)[0], ATTIC_SPANS.complete.from) && closeTo(span(box)[1], ATTIC_SPANS.complete.to), 'the Complete joists run the front half')
  }
  const pitched = atticJoistBoxes(false)
  assert.deepEqual(pitched.open.map(box => box.position[0]), xs, 'a pitched roof draws every joist in the open house')
  assert.deepEqual(pitched.complete.map(box => box.position[0]), xs, 'and every joist again in the front half of Complete')
  for (const box of [...pitched.open, ...pitched.complete]) {
    assert.ok(closeTo(box.size[1], HOUSE.joistDepth) && closeTo(reach(box, 1, -1), WALL_TOP_Y), 'a pitched roof\'s joist keeps its full depth on the wall tops')
  }
  assert.ok(pitched.open.every(box => closeTo(span(box)[0], ATTIC_SPANS.open.from) && closeTo(span(box)[1], ATTIC_SPANS.open.to)), 'pitched open joists span the open attic')
  assert.ok(pitched.complete.every(box => closeTo(span(box)[0], ATTIC_SPANS.complete.from) && closeTo(span(box)[1], ATTIC_SPANS.complete.to)), 'pitched Complete joists span the front attic')
}

// Gable vents: a through-vent, the frame and its slats on the gable's outer face and mirrored on its inner face, each set
// proud of its face and inside the vent's outline; a dark backing between them stands proud of both faces by less than the
// slats. The vent clears the rake above it, and the gable cracks' band stays under it even at Failing.
{
  const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-9
  const perSet = 4 + GABLE_VENT.slats
  const opening = { width: GABLE_VENT.width - GABLE_VENT.frame * 2, height: GABLE_VENT.height - GABLE_VENT.frame * 2 }
  for (const sign of [-1, 1] as const) {
    const centre = [sign * HOUSE.halfLength, WALL_TOP_Y + GABLE_VENT.rise, 0] as const
    const innerFace = centre[0] - sign * HOUSE.wallThickness
    const { louvres, backing } = gableVentBoxes(GABLE_VENT, centre, sign, HOUSE.wallThickness)
    assert.deepEqual(homeGableVent(sign), { louvres, backing }, `the home's ${sign} vent is the one checked here`)
    assert.equal(louvres.length, perSet * 2, `the ${sign} vent is a frame of four sides and its slats on each face`)
    for (const box of louvres) {
      assert.ok(Math.abs(box.position[2] - centre[2]) + box.size[2] / 2 <= GABLE_VENT.width / 2 + 1e-9, `a ${sign} vent box stays inside the vent's width`)
      assert.ok(Math.abs(box.position[1] - centre[1]) + box.size[1] / 2 <= GABLE_VENT.height / 2 + 1e-9, `a ${sign} vent box stays inside the vent's height`)
    }
    const span = (box: BoxSpec) => [box.position[0] - box.size[0] / 2, box.position[0] + box.size[0] / 2] as const
    const outerFrom = Math.min(centre[0], centre[0] + sign * GABLE_VENT.proud)
    const innerFrom = Math.min(innerFace, innerFace - sign * GABLE_VENT.proud)
    const outer = louvres.filter(box => near(span(box)[0], outerFrom) && near(span(box)[1], outerFrom + GABLE_VENT.proud))
    const inner = louvres.filter(box => near(span(box)[0], innerFrom) && near(span(box)[1], innerFrom + GABLE_VENT.proud))
    assert.equal(outer.length, perSet, `a full ${sign} set stands proud of the outer face, out of the house`)
    assert.equal(inner.length, perSet, `a full ${sign} set stands proud of the inner face, into the attic`)
    assert.deepEqual(inner.map(box => [box.size, box.position[1], box.position[2]]), outer.map(box => [box.size, box.position[1], box.position[2]]), `the ${sign} inner set mirrors the outer one`)
    assert.ok(near(backing.size[1], opening.height) && near(backing.size[2], opening.width) && near(backing.position[1], centre[1]) && near(backing.position[2], centre[2]), `the ${sign} backing fills the vent's opening`)
    const [from, to] = span(backing)
    const wallFrom = Math.min(centre[0], innerFace)
    const wallTo = Math.max(centre[0], innerFace)
    for (const beyond of [wallFrom - from, to - wallTo]) {
      assert.ok(beyond > 0 && beyond < GABLE_VENT.proud, `the ${sign} backing stands proud of each face, behind the slats`)
    }
  }
  const ventTop = WALL_TOP_Y + GABLE_VENT.rise + GABLE_VENT.height / 2
  for (const z of [-GABLE_VENT.width / 2, GABLE_VENT.width / 2]) {
    assert.ok(ventTop < roofUndersideY(z, 'pitched'), `the vent's top corner at z ${z} stays under the rake`)
  }
  // A crack box tilts about x, so its reach in y and z is its turned size.
  const reach = (box: BoxSpec) => {
    const angle = box.rotation?.[0] ?? 0
    const [, height, depth] = box.size
    return {
      y: (Math.abs(Math.cos(angle)) * height + Math.abs(Math.sin(angle)) * depth) / 2,
      z: (Math.abs(Math.sin(angle)) * height + Math.abs(Math.cos(angle)) * depth) / 2,
    }
  }
  const cracks = gableCracks(PAINT_WEAR_SHARE.heavy)
  for (const [sign, list] of [[-1, cracks.left], [1, cracks.right]] as const) {
    assert.ok(list.length > 0, `the ${sign} gable cracks at Failing`)
    const { louvres, backing } = homeGableVent(sign)
    for (const crack of list) {
      const { y, z } = reach(crack)
      for (const box of [...louvres, backing]) {
        const overlaps = Math.abs(crack.position[1] - box.position[1]) < y + box.size[1] / 2
          && Math.abs(crack.position[2] - box.position[2]) < z + box.size[2] / 2
        assert.ok(!overlaps, `a ${sign} gable crack at y ${crack.position[1].toFixed(3)} z ${crack.position[2].toFixed(3)} runs under the vent`)
      }
    }
  }
}

// The attic fan sits behind the left vent: no bigger than the vent, where Partly open opens the attic, turned to blow out
// through the gable, its back against the inner slats and never into them.
{
  const [x, y] = ATTIC_FAN_SPOT.position
  const innerFace = -HOUSE.halfLength + HOUSE.wallThickness
  const innerSlats = Math.max(...homeGableVent(-1).louvres.map(box => box.position[0] + box.size[0] / 2))
  assert.ok(ATTIC_FAN_LOOK.radius <= GABLE_VENT.height / 2, 'the fan is no taller than the vent it blows through')
  assert.ok(x < HOUSE.cutX, 'the fan sits where Partly open opens the attic')
  assert.ok(Math.abs(Math.sin(ATTIC_FAN_SPOT.rotationY) + 1) < 1e-9, 'the fan\'s own +z turns to the world\'s -x, out through the left gable')
  const face = x - ATTIC_FAN_LOOK.depth / 2
  assert.ok(face > innerFace, 'the fan\'s blowing face sits inside the gable\'s inner face')
  assert.ok(face >= innerSlats - 1e-9, 'the fan\'s blowing face stays clear of the vent\'s inner slats')
  const ventCentre = WALL_TOP_Y + GABLE_VENT.rise
  assert.ok(y + ATTIC_FAN_LOOK.radius <= ventCentre + GABLE_VENT.height / 2 && y - ATTIC_FAN_LOOK.radius >= ventCentre - GABLE_VENT.height / 2, 'the fan\'s top and bottom stay within the vent\'s height')
}

// The attic's openings and ducts: a boot only where the home has ducts, every opening between the joists and off the cut
// line, old ducts on the joists and hung ones level on straps between the deepest insulation and the roof.
for (const [hvacType, ducted] of [[null, true], ['central', true], ['package-unit', true], ['wall-mounted', false], ['portable', false]] as const) {
  const scene = resolveScene(inputs({ property: { ...shingleR11, hvacType }, weather: 'summer' }), cuts)
  assert.equal(scene.assemblies['hvac-attic'] !== undefined, ducted, `${hvacType}: ducts ${ducted}`)
}
assert.ok(!ceilingOpenings(false).some(opening => opening.kind === 'boot'), 'no boots without ducts')
for (const opening of CEILING_OPENINGS) {
  const reach = opening.radius + CEILING_OPENING_LOOK.collar.reach
  for (const joist of ATTIC_JOIST_XS) {
    assert.ok(Math.abs(opening.at[0] - joist) >= reach + HOUSE.joistWidth / 2, `${opening.kind} at ${opening.at}: clears the joist at ${joist}`)
  }
}
assert.deepEqual(ceilingOpenings(true).filter(o => o.kind === 'boot').map(o => o.at), EQUIPMENT.ductRuns.map(run => [run.at(-1)![0], run.at(-1)![2]]), 'a boot at every run end')
for (const opening of CEILING_OPENINGS.filter(o => o.kind !== 'boot')) {
  assert.ok(opening.at[1] < ATTIC_SPANS.open.to - opening.radius, `${opening.kind} at ${opening.at}: off the cut line`)
}
for (const [material, lowSlope, hangs] of [['r6-silver-flex', false, true], ['r8-flex', false, true], ['original-flex', false, false], [null, false, false], ['r6-silver-flex', true, false]] as const) {
  assert.equal(ductsHang(material, lowSlope), hangs, `${material} ${lowSlope}: hangs ${hangs}`)
}
const floorRuns = ductRunPoints('floor', EQUIPMENT.ductRadius, 0.05)
near(Math.min(...floorRuns.flat().map(p => p[1])), WALL_TOP_Y + HOUSE.joistDepth + EQUIPMENT.ductRadius, 1e-9, 'old ducts rest on the joists')
for (const radius of [EQUIPMENT.ductRadius, EQUIPMENT.ductRadius * WEAR_LOOKS.newDucts.r8Girth]) {
  const hung = ductRunPoints('hung', radius, 0)
  for (const run of hung) {
    const level = run.slice(0, -1)
    assert.ok(level.every(p => p[1] === level[0]![1]), 'a hung run is level')
    assert.ok(level[0]![1] - radius >= WALL_TOP_Y + DEEPEST_INSULATION, 'R-8 hangs clear of the deepest insulation')
    assert.ok(level.every(p => p[1] + radius < roofUndersideY(p[2], 'pitched')), 'and under the roof')
  }
  for (const strap of ductStrapBoxes(hung, radius)) {
    near(strap.position[1] + strap.size[1] / 2, roofUndersideY(strap.position[2], 'pitched'), 1e-9, 'a strap hangs from the roof underside')
  }
}
assert.equal(foamCollarsShown('pitched', 'sealed', null), true)
for (const [form, sealing, insulation] of [['pitched', 'sealed', 'batts-r11'], ['pitched', null, null], ['low-slope', 'sealed', null]] as const) {
  assert.equal(foamCollarsShown(form, sealing, insulation), false, `${form} ${sealing} ${insulation}: no collars`)
}
// The pipes' roof stubs and the roof lanes read the roof's surface from one rule, which puts the lanes where they were.
for (const [form, z, y] of [['pitched', -0.8, 4.158830368802246], ['pitched', 0.8, 4.158830368802246], ['low-slope', -1.9, 3.3]] as const) {
  near(coveringBaseY(z, form), y, 1e-12, `the ${form} covering's base at z ${z}`)
}
for (const form of ROOF_FORMS) {
  for (const lane of [...HOME_ROOF_HEAT_LANES[form], ...HOME_COMPLETE_ROOF_HEAT_LANES[form]]) {
    near(lane.covering[1], coveringBaseY(lane.covering[2], form), 1e-12, `a ${form} roof lane meets the covering's base`)
  }
}
// A pipe's flashing lies flat on the roof it comes through: its axis is the surface's normal, read off the covering's rise.
for (const form of ROOF_FORMS) {
  for (const flashing of ventPipeStubCylinders(form === 'low-slope', 'shingle').flashings) {
    const [, , z] = flashing.position
    const rise = (coveringBaseY(z + 1e-4, form) - coveringBaseY(z - 1e-4, form)) / 2e-4
    const normal = new Vector3(0, 1, -rise).normalize()
    const axis = new Vector3(0, 1, 0).applyEuler(new Euler(...(flashing.rotation ?? [0, 0, 0])))
    near(axis.y, normal.y, 1e-9, `the ${form} flashing at z ${z} lies on the roof (y)`)
    near(axis.z, normal.z, 1e-9, `the ${form} flashing at z ${z} lies on the roof (z)`)
  }
}

// One write vocabulary: the search, the missing facts and the era line all read what the slots and applySceneChange say.
const applyAll = (state: TradeSceneInputs, changes: readonly SceneChange[]) => changes.reduce((next, change) => ({ ...next, ...applySceneChange(next, change, YEAR) }), state)
const base = { ...HOME_SCENE_DEFAULTS }
const targetsOf = (state: TradeSceneInputs) => resolveScene(state, cuts, ASSEMBLY_KITS, YEAR)
const slotsOf = (state: TradeSceneInputs) => sceneChangeSlots(state, targetsOf(state), YEAR)
const top = (state: TradeSceneInputs, q: string) => searchSceneChanges(slotsOf(state), q)[0]
assert.equal(top(base, 'tile')?.slot.id, 'roof')
assert.equal(top(base, 'tile')?.hit, 'tile')
assert.equal(top({ ...base, property: { ...base.property, hvacType: 'central', hvacComponents: 'both' } }, '4')?.hit, '4', '"4" finds 4 ton')
assert.ok(slotsOf({ ...base, property: { ...base.property, hvacType: 'package-unit' } }).some(s => s.id === 'ac-tons'), 'a package unit has an AC size')
assert.ok(slotsOf({ ...base, property: { ...base.property, hvacType: null } }).some(s => s.id === 'hvac-components'), 'an unknown HVAC type still offers its equipment')
assert.deepEqual(searchSceneChanges(slotsOf(base), 'worn').map(r => r.slot.id).sort(), slotsOf(base).filter(s => s.id.startsWith('wear:')).map(s => s.id).sort())
assert.equal(top(base, 'attic fan')?.slot.group, 'proposed')
assert.equal(searchSceneChanges(slotsOf(base), 'zzqx').length, 0)
assert.equal(missingFacts(base).length, 5)
assert.equal(missingFacts(applyAll(base, [{ kind: 'property', patch: { foundationType: null } }])).length, 5, 'Not sure keeps a fact missing')
assert.deepEqual(missingFacts(applyAll(base, [{ kind: 'climate', climate: 'coastal' }])), ['foundation', 'roof-form', 'household', 'age-group'])
const line = eraCodeLine({ property: base.property, home: targetsOf(base).home })
assert.deepEqual(line, { era: '1950-1978', guessed: true, codes: ['R-11 attic', 'Single pane', 'Original ducts'], kept: [] })
assert.deepEqual(applySceneChange(base, { kind: 'roof-form', form: 'low-slope' }, YEAR).property?.roofType, 'flat')
const handSet = applyAll(base, [{ kind: 'property', patch: { roofType: 'shingle' } }, { kind: 'wear', id: 'roof', wear: 'worn' }, { kind: 'option', field: 'windowsType', value: 'double' }])
const coded = applyAll(handSet, [{ kind: 'era-code' }])
assert.equal(coded.homeMaterials.wear.roof, 'worn', 'Use code keeps the roof\'s Condition: the roof has no era code')
assert.equal(coded.property.roofType, 'shingle', 'Use code never touches the roof type')
assert.equal(coded.property.windowsType, null, 'Use code returns the windows to the era guess')
assert.deepEqual(eraCodeLine({ property: handSet.property, home: targetsOf(handSet).home }).kept, ['windows'])

// The rest of the vocabulary, and the slots' shape.
assert.equal(applySceneChange(handSet, { kind: 'roof-form', form: 'pitched' }, YEAR).property?.roofType, 'shingle', 'a pitched roof keeps its pitched type')
assert.equal(applySceneChange({ ...base, property: { ...base.property, roofType: 'flat' } }, { kind: 'roof-form', form: 'pitched' }, YEAR).property?.roofType, 'shingle', 'flat to pitched starts as shingle')
assert.equal(applySceneChange(handSet, { kind: 'roof-form', form: null }, YEAR).property?.roofType, null)
assert.deepEqual(applyAll(base, [{ kind: 'household', patch: { type: 'Family' } }]).household, { type: 'Family', ageGroup: null })
assert.equal(applyAll(base, [{ kind: 'bill', category: 'gas', now: 140 }]).bills.gas.now, 140)
assert.equal(applyAll(base, [{ kind: 'bill', category: 'gas', now: 140 }, { kind: 'bill', category: 'gas', now: null }]).bills.gas.now, null, 'a cleared bill goes back to the climate default')
assert.deepEqual(applyAll(base, [{ kind: 'efficiency-upgrade', upgrade: 'r8-ducts', on: true }]).efficiencyUpgrades, ['cool-roof', 'r8-ducts'])
assert.deepEqual(slotsOf(base).map(s => s.group).filter((group, i, all) => group !== all[i - 1]), ['facts', 'systems', 'existing', 'proposed', 'area', 'bills'], 'the slots run facts, year built, today, the build, area, bills')
assert.ok(slotsOf(base).every(s => typeof s.words === 'string' && s.words.length > 0), 'every slot has its words')
assert.equal(new Set(slotsOf(base).map(s => s.id)).size, slotsOf(base).length, 'slot ids are unique')
assert.ok(!slotsOf(base).some(s => s.id.includes('paint-wear')), 'paint wear is set in the system card only')
const flatRoof = applyAll(base, [{ kind: 'roof-form', form: 'low-slope' }])
assert.deepEqual(slotsOf(flatRoof).find(s => s.id === 'roof')?.options, [{ value: 'flat', label: 'Torch down' }], 'a flat roof has one covering')
const roofSlot = slotsOf(base).find(s => s.id === 'roof')
assert.ok(roofSlot)
assert.equal(applyAll(base, [roofSlot.change('tile')]).property.roofType, 'tile', 'a slot\'s change writes its value')
assert.equal(slotsOf(base).find(s => s.id === 'bill:electric')?.current, '200', 'a bill slot reads the bill in force')
assert.ok(slotsOf(base).filter(s => s.group === 'existing').length > 8, 'more of today\'s slots than a page holds')
assert.equal(searchSceneChanges(slotsOf(base), 'today').length, 8, 'at most eight results')
assert.equal(top(base, 'wood shake')?.hit, 'woodshake', 'two tokens that name one value pick it')
assert.equal(searchSceneChanges(slotsOf(base), 'tile metal').find(r => r.slot.id === 'roof')?.hit, null, 'tokens that name two values pick neither')
assert.equal(top(base, 'roof tile')?.hit, 'tile', 'a token that names only the slot leaves the value token\'s pick')
// An add-on no pick can take yet stays listed with why, and gives Enter nothing to set.
const coolRoofOf = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'upgrade:cool-roof')
assert.deepEqual([coolRoofOf(base)?.options, coolRoofOf(base)?.unavailable], [[], 'Preview a shingle or flat roof to add a cool roof.'], 'the cool roof stays listed before a covering is picked')
assert.deepEqual([top(base, 'cool roof')?.slot.id, top(base, 'cool roof')?.hit], ['upgrade:cool-roof', null], '"cool roof" finds it, with nothing to set')
const shingled = applyAll(base, [{ kind: 'property', patch: { roofType: 'shingle' } }])
const tornOff = applyAll(shingled, [slotsOf(shingled).find(s => s.id === 'build:covering')!.change(TEAR_OFF)])
assert.deepEqual([coolRoofOf(tornOff)?.unavailable, coolRoofOf(tornOff)?.current], [null, 'on'], 'a tear-off takes the cool roof')
const ductsRow = slotsOf({ ...base, property: { ...base.property, hvacType: 'central' } }).find(s => s.id === 'upgrade:r8-ducts')
assert.equal(ductsRow?.unavailable, 'Preview new ducts to step up to R-8.', 'R-8 stays listed before new ducts are picked')
assert.equal(sceneBurstKey({ ...base, climate: null }), sceneBurstKey({ ...base, climate: CLIMATE_FALLBACK }), 'setting the climate the scene already falls back on wakes nothing')

// The option rules the old panel and the slots share.
assert.deepEqual(roofTypeChoices('low-slope'), ['flat'])
assert.deepEqual(roofTypeChoices('pitched'), ['shingle', 'tile', 'woodshake', 'metal'])
assert.deepEqual(roofTypeChoices(null), ['shingle', 'tile', 'woodshake', 'flat', 'metal'])
assert.ok(!existingDuctChoices().includes('r8-flex'), 'R-8 is an upgrade, never what the home has')
assert.ok(hasAcUnit({ ...base.property, hvacType: 'package-unit' }), 'a package unit has AC')
assert.ok(!hasAcUnit({ ...base.property, hvacType: 'central', hvacComponents: 'furnace' }), 'a furnace alone has no AC')
assert.ok(showsEquipment({ ...base.property, hvacType: null }), 'an unknown HVAC type shows its equipment')
assert.ok(!showsEquipment({ ...base.property, hvacType: 'package-unit' }))
const rowOf = (facts: Parameters<typeof upgradeRows>[0], picks: string[], partId: string) => upgradeRows(facts, picks, []).flatMap(system => system.rows).find(row => row.offer.partId === partId)
const unsetCovering = rowOf({ property: base.property, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], 'covering')
assert.ok(unsetCovering)
assert.deepEqual(upgradeRowBlockedLine(unsetCovering, { property: base.property, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, []), { included: false, text: 'Set the roof under Home facts' })
const shakeFacts = { property: { ...base.property, roofType: 'woodshake' as const }, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }
const shakeDeck = rowOf(shakeFacts, [TEAR_OFF], 'deck')
assert.ok(shakeDeck)
assert.deepEqual(upgradeRowBlockedLine(shakeDeck, shakeFacts, [TEAR_OFF]), { included: true, text: ROOF_ATTIC.parts.find(part => part.id === 'covering')?.materials.shingle.needsBase?.copy.label }, 'a tear-off over shakes includes the deck\'s base')

console.log('verify-trade-scene: ok')
