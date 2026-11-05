import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { ArrowLane, BenefitsState, BoxSpec, CeilingOpening, CompleteWallLane, HomeReadings, HomeShell, HomeSystemId, HouseWall, PeelingBoxes, RoofHeatLane, SceneChange, SceneResolveInputs, StainBox, SurfaceStains, SystemLit, SystemPart, TradeSceneInputs, Vec3, WallHeatLane } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { ExistingConditions, HeatWeather, HomeMaterialFacts, PropertyProfile, ResolvedPart, Weather } from '@/shared/modules/construction/core/types'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { BoxGeometry, Color, Euler, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { REMODEL_ROI_CONFIG_DEFAULTS } from '@/features/calculators/remodel-roi-calculator/constants/config-defaults'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { ATTIC_FAN_LOOK } from '@/features/trade-scenes/constants/attic-fan-look'
import { ADD_ON_SYSTEM, TRADE_SYSTEM } from '@/features/trade-scenes/constants/benefit-systems'
import { CLIMATE_DEFAULT_BILLS, CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { INFER_EXISTING_CONDITIONS } from '@/features/trade-scenes/constants/existing-conditions'
import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { HOME_ANCHORS, INSIDE_READING_IDS, READING_ANCHORS, READING_CALLOUTS, READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { CEILING_OPENING_LOOK, FOUNDATION, FRONT_STEPS, GABLE_VENT, ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { AC_SCALE, PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { FADE_SHEET_ORDER, HOME_FADE_TAGS, HOME_FADES_SHOWN, HOME_GHOST_TAG } from '@/features/trade-scenes/constants/home-fades'
import { ATTIC_FAN_SPOT, ATTIC_JOIST_XS, ATTIC_SPANS, BACK_INNER, CEILING_OPENINGS, COVERING_BASE, COVERING_EAVE_X, CRAWL_SKIRT_BOXES, CRAWL_VENT_BOXES, DEEPEST_INSULATION, DOWNSPOUTS, EAVE_RUN, EQUIPMENT, FASCIA_CENTRE, FLOOR_FRAMING, FRONT_CORNERS, FRONT_CRAWL_SKIRT_BOXES, FRONT_CRAWL_VENT_BOXES, FRONT_DOOR, FRONT_OPENINGS, FRONT_WALL, FRONT_WALL_PROUD, GABLE_VENT_Y, GUTTER_BACK, HOME_FLOOR_Y, HOME_FRAMINGS, HOME_GHOST_OPACITY, HOME_ORBIT, HOUSE, HOUSE_WALLS, INSULATION_DEPTH, JOIST_DECK_GAP, LOW_SLOPE_DECK_Y, LOW_SLOPE_ROOF_Y, PARAPET_TOP, PIERS, RAFTER_ORIGIN_Y, RAFTER_PROFILE, RIDGE_Y, ROOF_HALF_LENGTH, SIDE_SKIN_FROM, SLOPE_LENGTH, WALL_TOP_Y, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { HEAT_ARROW_SCALE, HEAT_FLOW_STOPPED, METER_LEVEL, PART_HEAT_EFFECTS, STARTING_HOME_HEAT } from '@/features/trade-scenes/constants/home-heat-figures'
import { ATTIC_FAN_LANE, CEILING_LEAK_LANE, HOME_COMPLETE_ROOF_HEAT_LANES, HOME_COMPLETE_WALL_HEAT_LANES, HOME_COMPLETE_WINDOW_HEAT_LANES, HOME_ROOF_HEAT_LANES, HOME_WALL_HEAT_LANES, HOME_WINDOW_HEAT_LANES, LANE_STANDOFF, OPEN_LANE_REACH } from '@/features/trade-scenes/constants/home-heat-lanes'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { GARAGE, LOT } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import * as HOME_SCENE_COPY from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_COPY, EFFICIENCY_UPGRADE_LABELS, SYSTEM_PART_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { BUILD_ROW_PART_IDS, HOME_SYSTEMS, LOOK_INSIDE_SYSTEM_IDS, SPOT_OF } from '@/features/trade-scenes/constants/home-systems'
import { CRAWL_AIR } from '@/features/trade-scenes/constants/home-temperatures'
import { HOME_PAINT_KEYS } from '@/features/trade-scenes/constants/home-thermal-zones'
import { LOOK_INSIDE } from '@/features/trade-scenes/constants/look-inside'
import { PAINT_WEAR_SHARE, PAINT_WEAR_START, PEELING_SEEDS, STAIN_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { HOME_VIEWS, LEAVE_LOOK_INSIDE, SCENE_WEATHERS } from '@/features/trade-scenes/constants/scene-controls'
import { SCOPE_VERBS } from '@/features/trade-scenes/constants/scope-verbs'
import { lookInsideView, SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import { WEAR_AMOUNT, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { createTapClaim } from '@/features/trade-scenes/contexts/scene-tap-claim-context'
import { applySceneChange } from '@/features/trade-scenes/lib/apply-scene-change'
import { arrowStations } from '@/features/trade-scenes/lib/arrow-stations'
import { atticFanRuns } from '@/features/trade-scenes/lib/attic-fan-runs'
import { atticInsulationBoxes, atticInsulationTop } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { atticJoistBoxes } from '@/features/trade-scenes/lib/attic-joist-boxes'
import { benefitsStepBack } from '@/features/trade-scenes/lib/benefits-step-back'
import { buildBenefits } from '@/features/trade-scenes/lib/build-benefits'
import { castResidents } from '@/features/trade-scenes/lib/cast-residents'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { comfortFromReadings } from '@/features/trade-scenes/lib/comfort-from-readings'
import { pressHomeView } from '@/features/trade-scenes/lib/controls-press'
import { coveringBaseY } from '@/features/trade-scenes/lib/covering-base-y'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { ductRunPoints } from '@/features/trade-scenes/lib/duct-run-points'
import { ductStrapBoxes } from '@/features/trade-scenes/lib/duct-strap-boxes'
import { ductsHang } from '@/features/trade-scenes/lib/ducts-hang'
import { efficiencyUpgradePatch } from '@/features/trade-scenes/lib/efficiency-upgrade-patch'
import { eraCodeLine } from '@/features/trade-scenes/lib/era-code-line'
import { escapeStep } from '@/features/trade-scenes/lib/escape-step'
import { foamCollarsShown } from '@/features/trade-scenes/lib/foam-collars-shown'
import { FOUNDATION_FRONT_WALL, FOUNDATION_WALLS, RAISED_GROUND_STRETCH } from '@/features/trade-scenes/lib/foundation-walls'
import { framingTowardPart, partOffset } from '@/features/trade-scenes/lib/framing-toward-part'
import { FRONT_DOOR_BOXES } from '@/features/trade-scenes/lib/front-door-boxes'
import { futureYear } from '@/features/trade-scenes/lib/future-year'
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
import { keepEfficiencyUpgrades } from '@/features/trade-scenes/lib/keep-efficiency-upgrades'
import { keepLookInside } from '@/features/trade-scenes/lib/keep-look-inside'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { lowSlopeRoofBoxes } from '@/features/trade-scenes/lib/low-slope-roof-boxes'
import { existingDuctChoices, hasAcUnit, roofTypeChoices, showsEquipment } from '@/features/trade-scenes/lib/material-option-choices'
import { missingFacts } from '@/features/trade-scenes/lib/missing-facts'
import { packageUnitDrop, packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'
import { doorFramePeeling, fasciaPeeling, wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { FRONT_STAIN_WALL, gableVentOpening, paintedSurfaceStains, paintTopEdge, roofPeeling, splitAlong, splitAtSeam, STAIN_WALLS } from '@/features/trade-scenes/lib/painted-surface-stains'
import { partPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { pickedUpgrades } from '@/features/trade-scenes/lib/picked-upgrades'
import { piecesInSpan } from '@/features/trade-scenes/lib/pieces-in-span'
import { railGroups } from '@/features/trade-scenes/lib/rail-groups'
import { readingPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { gableCracks, LEFT_PARAPET_CUT, parapetCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { sceneBurstKey } from '@/features/trade-scenes/lib/scene-burst-key'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'
import { scopePreviewPatch } from '@/features/trade-scenes/lib/scope-preview-patch'
import { searchSceneChanges } from '@/features/trade-scenes/lib/search-scene-changes'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { spotFromPinId, spotPinId } from '@/features/trade-scenes/lib/spot-pin-id'
import { spotPinPoint } from '@/features/trade-scenes/lib/spot-pin-point'
import { fadeBlotches, runoffStreaks, sillDirt, splashBand } from '@/features/trade-scenes/lib/stain-boxes'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'
import { systemCuts } from '@/features/trade-scenes/lib/system-cuts'
import { systemMaterialIds } from '@/features/trade-scenes/lib/system-material-ids'
import { systemOfPart } from '@/features/trade-scenes/lib/system-of-part'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'
import { systemPartOpacity } from '@/features/trade-scenes/lib/system-part-opacity'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { systemPartRows, systemPartsShown, systemStory } from '@/features/trade-scenes/lib/system-parts-shown'
import { canLookInside, systemsAtSpot } from '@/features/trade-scenes/lib/systems-at-spot'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { afterCosts, todayCosts } from '@/features/trade-scenes/lib/today-costs'
import { upgradeRowBlockedLine } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { upgradeScope, withUpgradeScopes } from '@/features/trade-scenes/lib/upgrade-scopes'
import { ventPipeStubCylinders } from '@/features/trade-scenes/lib/vent-pipe-stub-cylinders'
import { sillLedgeBox, windowBoxes } from '@/features/trade-scenes/lib/window-boxes'
import { yearLabel } from '@/features/trade-scenes/lib/year-label'
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
import { formatAsDollars } from '@/shared/lib/formatters'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ROOF_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/roof-attic'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'
import { BENEFIT_KINDS } from '@/shared/modules/construction/core/constants/benefit-kinds'
import { BILL_CUT_ADD_ON_IDS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import { BILL_GROWTH_RATES_PERCENT } from '@/shared/modules/construction/core/constants/bill-growth-rates'
import { CLIMATE_PRESETS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'
import { CONSTRUCTION_GROWTH_RATE_PERCENT } from '@/shared/modules/construction/core/constants/construction-growth-rate'
import { EFFICIENCY_UPGRADE_IDS } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import { INSULATION_LEVEL_LABELS, insulationLevels, roofTypes, wears } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIAL_FACTS_UNSET, HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { NOT_DRAWN } from '@/shared/modules/construction/core/constants/scope-not-drawn'
import { TRADE_BILL_CUTS } from '@/shared/modules/construction/core/constants/trade-bill-cuts'
import { UPGRADE_REGISTRY } from '@/shared/modules/construction/core/constants/upgrade-registry'
import { combineCuts } from '@/shared/modules/construction/core/lib/combine-cuts'
import { cutFor } from '@/shared/modules/construction/core/lib/cut-for'
import { fillBenefitText } from '@/shared/modules/construction/core/lib/fill-benefit-text'
import { installedMaterial } from '@/shared/modules/construction/core/lib/installed-material'
import { projectBillYears } from '@/shared/modules/construction/core/lib/project-bill-years'
import { relativeWaterFlow } from '@/shared/modules/construction/core/lib/relative-water-flow'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'

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
// The heat figures were tuned on the full build with the replace at R-38.
const FULL_BUILD_UPGRADES: EfficiencyUpgradeId[] = ['cool-roof', 'r38-insulation']
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
  const property = profile({ yearBuilt: '1950-1978', roofType, insulationLevel: 'r11' })
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
const coolSummer = resolveScene(inputs({ property: profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel: 'r11' }), view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
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
  if (name === 'tile reset') {
    assert.ok(scene.savings.repairsByTrade['roof-and-gutters'], `${name}: the roof trade lands`)
  }
  else {
    assert.equal(scene.savings.repairsByTrade['roof-and-gutters'], undefined, `${name}: no new covering, so the roof's upkeep runs on`)
  }
  assert.ok(!scene.savings.cuts.electric.parts.some(part => part.source === 'roof-and-gutters'), `${name}: no roof part without a cool covering`)
}
const wornRoofHome = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } } } as const
const guttersAndRedeck = resolveScene(inputs({ ...wornRoofHome, property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [GUTTERS, REDECK] }), cuts).savings
assert.deepEqual(guttersAndRedeck.repairsByTrade, {}, 'gutters and a redeck leave the roof\'s upkeep running')
for (const id of HOME_MATERIAL_IDS) {
  const { repairs, repairsEndWith, parts } = HOME_MATERIALS[id]
  assert.equal(repairsEndWith.length > 0, repairs, `${id}: only a material with upkeep names the parts that end it`)
  assert.ok(repairsEndWith.every(end => parts.some(part => part.assembly === end.assembly && part.part === end.part)), `${id}: they are its own parts`)
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

// Comfort: the gap between the ceiling surface and the setpoint, either way.
const readings = (ceiling: number): HomeReadings => ({ 'roof': 0, 'attic': 0, ceiling, 'exterior-wall': 0, 'window': 0 })
assert.equal(comfortFromReadings(readings(80.2), 76), 'strained', '4.2 °F over is strained')
assert.equal(comfortFromReadings(readings(65.8), 70), 'strained', '4.2 °F under is strained')
assert.equal(comfortFromReadings(readings(79.5), 76), 'fair')
assert.equal(comfortFromReadings(readings(78.8), 76), 'comfortable', '2.8 °F is comfortable')
assert.equal(comfortFromReadings(readings(68.4), 70), 'comfortable')

const shingleR11 = profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel: 'r11' })
const strained = resolveScene(inputs({ property: shingleR11, weather: 'summer', climate: 'inland', view: 'existing' }), cuts)
assert.equal(strained.comfort, 'strained', `R-11 inland summer today (ceiling ${strained.heat?.readings.ceiling})`)
const comfortable = resolveScene(inputs({ property: shingleR11, weather: 'summer', climate: 'inland', view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: FULL_BUILD_UPGRADES }), cuts)
assert.equal(comfortable.comfort, 'comfortable', `full build with cool roof and R-38 inland summer (ceiling ${comfortable.heat?.readings.ceiling})`)
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

// Cool roof off: the covering stays standard and the roof cuts nothing.
const coolOff = resolveScene(inputs({ property: shingleR11, weather: 'summer', view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: [], bills: BILLS }), cuts)
assert.ok(!coolOff.savings.cuts.electric.parts.some(part => part.source === 'roof-and-gutters'), 'no roof part in the cut')
assert.equal(roofAttic(coolOff).parts.find(part => part.id === 'covering')?.material, 'shingle')

const YEAR = 2026
const at = (patch: Partial<TradeSceneInputs>) => resolveScene(inputs(patch), cuts, YEAR)
const allHome = at({ property: profile({ foundationType: 'raised', hvacType: 'central' }) })
assert.deepEqual(Object.keys(allHome.assemblies).sort(), ['crawl-space', 'exterior-wall', 'hvac-attic', 'roof-attic', 'windows'], 'every assembly that applies, never the yard')
assert.equal(at({ property: profile({ hvacType: 'wall-mounted', foundationType: 'slab' }) }).assemblies['hvac-attic'], undefined)
const recentRain = at({ property: profile({ yearBuilt: 'Post-2014' }), weather: 'rain' })
assert.equal(recentRain.leak.reachesInside, 0, 'a Post-2014 roof no longer leaks')
assert.ok(at({ property: profile({ yearBuilt: '1950-1978' }), weather: 'rain' }).leak.reachesInside > 0, 'an era-worn roof still does')
const fairRoof: Partial<TradeSceneInputs> = { property: profile({ yearBuilt: '1950-1978' }), homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'fair' } }, weather: 'rain' }
assert.equal(at(fairRoof).leak.reachesInside, 0, 'a Fair roof keeps the rain out')
assert.equal(at({ ...fairRoof, cameraFocus: 'roof', lookInside: true }).assemblies['roof-attic']?.water?.reachesInside ?? 0, 0, 'up close, a Fair roof keeps the rain out too')
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
const regularHome = profile({ yearBuilt: '1950-1978', roofType: 'shingle' })
const paintOf = (scene: ReturnType<typeof at>) => scene.assemblies['exterior-wall']!.parts.find(part => part.id === 'paint')!
const waterBased = at({ property: regularHome, view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], efficiencyUpgrades: [], bills: BILLS })
assert.equal(paintOf(waterBased).material, 'standard')
assert.ok(!waterBased.savings.cuts.electric.parts.some(part => part.source === 'exterior-paint-stucco-and-siding'), 'a water-based repaint cuts no bill')
assert.ok((waterBased.savings.repairsByTrade['exterior-paint-stucco-and-siding']?.value ?? 0) > 0, 'and fresh paint still earns its repairs')
const coolLife = at({ property: regularHome, view: 'proposed', proposedScopeIds: [SCOPE_IDS.coolLifeRepaint], efficiencyUpgrades: ['cool-paint'], bills: BILLS })
assert.ok(coolLife.savings.cuts.electric.parts.some(part => part.source === 'exterior-paint-stucco-and-siding'), 'Cool Life paint cuts the electric bill')
const todayHeat = at({ property: regularHome, weather: 'summer' }).heat
assert.deepEqual(at({ property: regularHome, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], efficiencyUpgrades: [] }).heat, todayHeat, 'a water-based repaint moves no reading, arrow or load')
assert.notDeepEqual(at({ property: regularHome, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.coolLifeRepaint], efficiencyUpgrades: ['cool-paint'] }).heat, todayHeat, 'Cool Life does')
const regularFacts = { property: regularHome, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }
const coolFacts = { ...regularFacts, materials: { ...HOME_MATERIAL_FACTS_UNSET, exteriorPaint: 'cool' as const } }
assert.equal(upgradeScope('cool-paint', ['cool-paint'], 'standard'), SCOPE_IDS.coolLifeRepaint)
assert.equal(upgradeScope('cool-paint', [], 'standard'), SCOPE_IDS.waterBasedRepaint)
assert.equal(upgradeScope('cool-paint', [], 'cool'), SCOPE_IDS.coolLifeRepaint, 'a Cool Life home repaints with Cool Life whatever the switch says')
assert.deepEqual(withUpgradeScopes([SCOPE_IDS.coolLifeRepaint], [], regularFacts), [SCOPE_IDS.waterBasedRepaint], 'switched off, the pick is the water-based scope')
assert.deepEqual(withUpgradeScopes([SCOPE_IDS.waterBasedRepaint], [], coolFacts), [SCOPE_IDS.coolLifeRepaint], 'a Cool Life home never holds the water-based scope')
const paintRow = (facts: Parameters<typeof upgradeRows>[0], picks: string[], upgrades: EfficiencyUpgradeId[]) => upgradeRows(facts, picks, upgrades).flatMap(system => system.rows).find(row => row.offer.partId === 'paint')!
assert.deepEqual(paintRow(regularFacts, [], ['cool-paint']).scopeIds, [SCOPE_IDS.coolLifeRepaint], 'one repaint chip, the Cool Life scope while the switch is on')
assert.deepEqual(paintRow(regularFacts, [], []).scopeIds, [SCOPE_IDS.waterBasedRepaint], 'and the water-based scope while it is off')
assert.equal(paintRow(regularFacts, [SCOPE_IDS.waterBasedRepaint], []).kinds[SCOPE_IDS.waterBasedRepaint], 'like-for-like')
assert.equal(paintRow(regularFacts, [SCOPE_IDS.coolLifeRepaint], ['cool-paint']).kinds[SCOPE_IDS.coolLifeRepaint], 'saves-energy')
assert.equal(paintRow(coolFacts, [SCOPE_IDS.coolLifeRepaint], []).kinds[SCOPE_IDS.coolLifeRepaint], 'like-for-like', 'Cool Life over Cool Life saves nothing')
assert.deepEqual(keepEfficiencyUpgrades(['cool-roof', 'cool-paint'], []), ['cool-roof', 'cool-paint'], 'Cool Life paint stays as the rep left it when the repaint is unpicked')
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
assert.deepEqual(HOME_SCENE_DEFAULTS.efficiencyUpgrades, ['cool-roof', 'cool-paint'], 'every roof and repaint pick starts on the upgrade')
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

// The house draws every weather, so the roof's mode and water are the model's: no kit decides them.
const rainRoof = roofAttic(resolveScene(inputs({ property: shingleR11, weather: 'rain' }), cuts))
assert.equal(rainRoof.mode, 'water', 'the roof draws rain')
assert.notEqual(rainRoof.water, null, 'and its water resolves')
assert.equal(roofAttic(resolveScene(inputs({ property: shingleR11, weather: 'summer' }), cuts)).mode, 'thermal', 'and its heat in summer')

// The heat figures: one hand-tuned table, composed from what the home has.
function near(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`)
}
const HEAT_WEATHERS: readonly HeatWeather[] = ['normal', 'summer', 'winter']
const shellOf = (scene: ReturnType<typeof resolveScene>): HomeShell => ({ parts: Object.values(scene.assemblies).flatMap(assembly => assembly.parts), form: homeRoofForm(roofAttic(scene).form) })
const todayIn = (climate: Climate, weather: HeatWeather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate }), cuts)))
const buildIn = (climate: Climate, weather: HeatWeather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate, view: 'proposed', proposedScopeIds: FULL_BUILD, efficiencyUpgrades: FULL_BUILD_UPGRADES }), cuts)))

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

// Every string the screen can show, from every copy object, never says "your" and never mentions solar.
const SAMPLE_ARGS: readonly unknown[][] = [
  ...['electric', 'gas'].map(category => [category]),
  ...SCENE_WEATHERS.map(weather => [weather]),
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
const screenCopy = [
  ...Object.entries(HOME_SCENE_COPY).flatMap(([name, value]) => copyStrings(value, name)),
  ...copyStrings(UPGRADE_REGISTRY, 'UPGRADE_REGISTRY'),
]
assert.ok(screenCopy.some(([path]) => path.startsWith('SAVINGS_COPY.')) && screenCopy.some(([path]) => path.startsWith('PANEL_COPY.')), 'the copy walk reaches the savings and panel copy')
for (const [path, line] of screenCopy) {
  assert.ok(!/\byour\b/i.test(line), `${path}: no "your" (${line})`)
  assert.ok(!/solar/i.test(line), `${path}: never solar (${line})`)
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
  'low-slope': { property: profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: 'r11' }), build: [TORCH_DOWN, ATTIC_REPLACEMENT] },
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
assert.deepEqual(lifted, { position: [1, 2.3, 3], target: [4, 5.3, 6], fov: 35 }, 'a framing rises with the house')
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

// A gable's package unit stands on the far slope over the plenum, level on its curb, and its air comes down a drop into
// the trunk; a flat roof's stays where it was.
{
  const backSlopeY = (z: number) => WALL_TOP_Y + HOUSE.heel + (HOUSE.halfDepth + z) * Math.tan(PITCH) + (COVERING_BASE + SHINGLE.thickness) / Math.cos(PITCH)
  // The vented ridge is the deeper of the two, 0.42 m across.
  const RIDGE_HALF = 0.21
  // The roof's top at a point, ridge cap included, for a sight line to pass over; null off the roof.
  const RIDGE_CAP_TOP = RIDGE_Y + (COVERING_BASE + 0.04) / Math.cos(PITCH) + 0.045
  const roofTopAt = (x: number, z: number) => Math.abs(x) > ROOF_HALF_LENGTH || Math.abs(z) > HOUSE.halfDepth + HOUSE.eaveOverhang
    ? null
    : Math.max(backSlopeY(-Math.abs(z)), Math.abs(z) <= RIDGE_HALF ? RIDGE_CAP_TOP : -Infinity)
  for (const scale of [1, ...Object.values(AC_SCALE)]) {
    const placement = packageUnitPlacement(false, scale)
    const { position: [x, top, z], curb } = placement
    const { at: [curbX, curbZ], footprint: [curbW, curbD], bottom } = curb
    assert.ok(z < 0, `at scale ${scale} the gable's package unit stands on the far slope (z ${z})`)
    assert.ok(Math.abs(x - plenumX) <= plenumW / 2 && Math.abs(z - plenumZ) <= plenumD / 2, `at scale ${scale} the unit stands over the plenum`)
    assert.ok(curbX === x && curbZ === z && curb.top === top, `at scale ${scale} the unit stands on its curb's level top`)
    const corners = [[curbZ - curbD / 2, bottom.back], [curbZ + curbD / 2, bottom.front]].flatMap(([cornerZ, cornerY]) => [-1, 1].map(side => [curbX + side * curbW / 2, cornerY, cornerZ] as const))
    for (const [cornerX, cornerY, cornerZ] of corners) {
      const depth = backSlopeY(cornerZ) - cornerY
      assert.ok(depth >= 0 && depth <= 0.02 + 1e-9, `at scale ${scale} the curb's corner ${cornerX.toFixed(2)},${cornerZ.toFixed(2)} sits ${depth.toFixed(3)} m under the far slope, not within 0.02`)
    }
    assert.ok(curbZ + curbD / 2 <= -RIDGE_HALF, `at scale ${scale} the curb reaches ${(curbZ + curbD / 2).toFixed(2)}, under the ridge cap`)
    assert.ok(curbZ - curbD / 2 >= -HOUSE.halfDepth, `at scale ${scale} the curb hangs past the back wall over the eave`)

    const drop = packageUnitDrop(placement)
    const [dropW, dropH, dropD] = drop.size
    const [dropX, dropY, dropZ] = drop.position
    const dropTop = dropY + dropH / 2
    const undersideAt = (at: number) => bottom.back + (bottom.front - bottom.back) * (at - (curbZ - curbD / 2)) / curbD
    assert.ok([dropZ - dropD / 2, dropZ + dropD / 2].every(at => dropTop >= undersideAt(at) - 1e-9) && dropTop < curb.top, `at scale ${scale} the drop meets the curb's underside all across it`)
    assert.ok(Math.abs(dropX - curbX) + dropW / 2 <= curbW / 2 && Math.abs(dropZ - curbZ) + dropD / 2 <= curbD / 2, `at scale ${scale} the drop comes down inside the curb`)
    near(dropY - dropH / 2, PACKAGE_UNIT.trunk.top, 1e-9, `at scale ${scale} the drop ends on the trunk's top`)
    assert.ok(Math.abs(dropX - plenumX) + dropW / 2 <= plenumW / 2 && Math.abs(dropZ - plenumZ) + dropD / 2 <= plenumD / 2, `at scale ${scale} the drop lands on the trunk`)

    const flatTop = LOW_SLOPE_ROOF_Y + PACKAGE_UNIT.curbHeight
    assert.deepEqual(packageUnitPlacement(true, scale), {
      position: [-1.6, flatTop, -1.3],
      curb: { at: [-1.6, -1.3], footprint: [PACKAGE_UNIT.size[0] * scale + 0.1, PACKAGE_UNIT.size[2] * scale + 0.1], top: flatTop, bottom: { back: LOW_SLOPE_ROOF_Y, front: LOW_SLOPE_ROOF_Y } },
    }, `at scale ${scale} the flat roof's unit stays where it was`)

    // From its heating & cooling view the whole unit shows: no sight line to a corner of its curb's foot or its lid passes
    // under the roof or the ridge cap on the way.
    const [unitL, unitH, unitD] = PACKAGE_UNIT.size
    const lidCorners = [-1, 1].flatMap(sx => [-1, 1].map(sz => [x + sx * (unitL + 0.06) * scale / 2, top + (unitH + 0.04) * scale, z + sz * (unitD + 0.06) * scale / 2] as const))
    for (const shape of ['landscape', 'narrow', 'portrait'] as const) {
      const { position: camera } = SYSTEM_CAMERA_VIEWS['heating-cooling']('pitched', shape, 0, { type: 'package-unit', scale })
      for (const corner of [...corners, ...lidCorners]) {
        const length = Math.hypot(camera[0] - corner[0], camera[1] - corner[1], camera[2] - corner[2])
        const steps = Math.ceil(length / 0.02)
        for (let step = 0; step <= steps; step++) {
          const along = step / steps
          // The last few centimetres stand on the curb itself.
          if (along * length < 0.15) {
            continue
          }
          const [px, py, pz] = [0, 1, 2].map(axis => corner[axis] + (camera[axis] - corner[axis]) * along)
          const roof = roofTopAt(px, pz)
          assert.ok(roof === null || py > roof, `${shape} at scale ${scale}: the roof hides the unit's corner ${corner.map(v => v.toFixed(2))} at ${[px, py, pz].map(v => v.toFixed(2))}`)
        }
      }
    }

    for (const form of ROOF_FORMS) {
      for (const lift of [0, 0.6]) {
        const packaged = SYSTEM_CAMERA_VIEWS['heating-cooling'](form, 'landscape', lift, { type: 'package-unit', scale })
        const [ux, uy, uz] = packageUnitPlacement(form === 'low-slope', scale).position
        assert.deepEqual(packaged.target, [ux, uy + lift, uz], `${form} at scale ${scale}: heating & cooling looks at the package unit`)
        for (const type of [null, 'central'] as const) {
          const central = SYSTEM_CAMERA_VIEWS['heating-cooling'](form, 'landscape', lift, { type, scale })
          assert.deepEqual(central.target, EQUIPMENT.condenser.position, `${form} ${type}: heating & cooling looks at the condenser's pad`)
        }
      }
    }
  }
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

// Every framing the app can glide to keeps its target inside the pan box, so a glide never fights the clamp: the home's,
// the crawl's, and up close each system's view and its lean toward every system part. The slab crawl framing is never used.
assert.equal(homeLift('slab'), HOME_FLOOR_Y.slab - HOUSE.floorY, 'the slab lift is the floor height above the drawn floor')
assert.equal(homeLift('raised'), HOME_FLOOR_Y.raised - HOUSE.floorY, 'the raised lift is the floor height above the drawn floor')
assert.equal(homeLift(null), HOME_FLOOR_Y.slab - HOUSE.floorY, 'an unknown foundation lifts as a slab')
function inPanBox(box: { min: readonly number[], max: readonly number[] }, point: readonly number[], label: string) {
  const outside = [0, 1, 2].filter(axis => point[axis] < box.min[axis] - 1e-9 || point[axis] > box.max[axis] + 1e-9)
  assert.deepEqual(outside, [], `${label}: [${point.map(value => value.toFixed(2)).join(', ')}] lies inside the pan box [${box.min.map(value => value.toFixed(2)).join(', ')}] .. [${box.max.map(value => value.toFixed(2)).join(', ')}]`)
}
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
  let leans = 0
  for (const form of ROOF_FORMS) {
    for (const system of LOOK_INSIDE_SYSTEM_IDS) {
      for (const shape of ['landscape', 'narrow', 'portrait'] as const) {
        for (const type of ['central', 'package-unit'] as const) {
          const framing = lookInsideView(system, form, shape, lift, { type, scale: 1 })
          const label = `${foundation} ${form} ${system} ${shape} ${type}`
          inPanBox(box, framing.target, `${label}: up close`)
          for (const { id } of SYSTEM_PARTS.filter(entry => (entry.systems as readonly HomeSystemId[]).includes(system))) {
            const point = systemPartFocus(system, form, id)
            if (point) {
              leans += 1
              inPanBox(box, framingTowardPart(framing, partOffset(framing, point, lift)).target, `${label}: the lean toward ${id}`)
            }
          }
        }
      }
    }
  }
  assert.ok(leans > 300, `${foundation}: the pan check reaches the part leans (${leans})`)
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
  assert.equal(paintLook({ material: 'standard', wear: 0 }, PAINT_WEAR_START.worn, true).color, HOME_PALETTE.paintCool, 'a water-based repaint takes the build colour')
  assert.equal(paintLook({ material: 'cool', wear: 0 }, PAINT_WEAR_START.worn, true).color, HOME_PALETTE.paintCool, 'so does Cool Life: the switch never changes the colour')
  assert.equal(paintLook({ material: 'cool', wear: 0.75 }, PAINT_WEAR_START.worn, false).color, wornColor(HOME_PALETTE.paintCool, WEAR_LOOKS.paint.chalk, 0.75), 'today\'s Cool Life keeps its colour')
  assert.equal(paintLook({ material: 'standard', wear: 0 }, PAINT_WEAR_START.worn, false).color, HOME_PALETTE.stucco, 'today\'s new regular paint keeps the stucco colour')
  assert.equal(paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn, false).wear, 0.75)
  assert.deepEqual(paintLook({ material: 'standard', wear: 0 }, { cracks: 'heavy', stains: 'heavy', peeling: 'heavy' }, false).paintWear, { cracks: 'none', stains: 'none', peeling: 'none' }, 'new or installed paint shows no paint wear, whatever was recorded')
  assert.deepEqual(paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn, false).paintWear, PAINT_WEAR_START.worn, 'worn paint shows the levels it is given')
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

// A painted surface stains all the way up to its top edge: the rake on a gable wall, the cap on a flat roof. The wall's half of a
// stain stays on the wall, the gable's or parapet's half inside that face, and the two meet at the seam as one stain. The eave
// walls keep their look, the vents stay clear, and the left parapet's front half takes only what lies in front of its cut.
{
  type Side = 'back' | 'left' | 'right' | 'front'
  const eps = 1e-9
  const stainFace = HOUSE.wallThickness / 2 + 0.002
  const walls = { ...Object.fromEntries(STAIN_WALLS.map(({ side, wall }) => [side, wall])), front: FRONT_STAIN_WALL } as Record<Side, HouseWall>
  const openingsOf = (side: Side) => side === 'front' ? FRONT_OPENINGS : walls[side].openings
  const axesOf = (wall: HouseWall) => wall.run === 'x' ? [0, 2] as const : [2, 0] as const
  const span = (box: BoxSpec, axis: 0 | 1 | 2) => [box.position[axis] - box.size[axis] / 2, box.position[axis] + box.size[axis] / 2] as const
  const sideOf = (box: StainBox, where: string): Side => {
    const sides = (Object.keys(walls) as Side[]).filter((side) => {
      const [, across] = axesOf(walls[side])
      return box.size[across] === 0 && Math.abs(box.position[across] - (walls[side].line + walls[side].outward * stainFace)) <= 0.01
    })
    assert.equal(sides.length, 1, `${where}: a stain lies flat on one wall's stain face`)
    return sides[0]
  }
  const alongOf = (box: StainBox, side: Side) => span(box, axesOf(walls[side])[0])
  const vents = { left: gableVentOpening('left'), right: gableVentOpening('right') }
  const ventBottom = GABLE_VENT_Y - GABLE_VENT.height / 2
  assert.deepEqual(vents.left, { along: 0, width: GABLE_VENT.width, sill: ventBottom - HOUSE.floorY, head: ventBottom - HOUSE.floorY + GABLE_VENT.height }, 'the gable vent\'s opening is the drawn vent')
  for (const side of ['left', 'right'] as const) {
    const louvres = homeGableVent(side === 'left' ? -1 : 1).louvres
    near(Math.min(...louvres.map(box => box.position[1] - box.size[1] / 2)), HOUSE.floorY + vents[side].sill, 1e-9, `the ${side} vent's sill is the drawn vent's bottom`)
    near(Math.max(...louvres.map(box => box.position[1] + box.size[1] / 2)), HOUSE.floorY + vents[side].head, 1e-9, `the ${side} vent's head is the drawn vent's top`)
  }
  const clearOf = (opening: { along: number, width: number, sill: number, head: number }, along: readonly [number, number], rise: readonly [number, number]) =>
    along[1] <= opening.along - opening.width / 2 + eps || along[0] >= opening.along + opening.width / 2 - eps
    || rise[1] <= HOUSE.floorY + opening.sill + eps || rise[0] >= HOUSE.floorY + opening.head - eps
  for (const side of Object.keys(walls) as Side[]) {
    assert.ok(Object.values(vents).every(vent => !openingsOf(side).some(opening => isDeepStrictEqual(opening, vent))), `the ${side} wall's openings hold no gable vent`)
  }

  // An eave face changes nothing.
  const eave = { topEdge: () => WALL_TOP_Y, vents: [] }
  for (const [index, wall] of [...Object.values(HOUSE_WALLS) as HouseWall[], FRONT_WALL, ...Object.values(walls)].entries()) {
    for (const seed of [21 + index, 31 + index, 1234]) {
      for (const share of [0.5, 1, 4 / 3]) {
        assert.deepEqual(runoffStreaks(wall, HOUSE.floorY, WALL_TOP_Y, share, seed, wall.openings, eave), runoffStreaks(wall, HOUSE.floorY, WALL_TOP_Y, share, seed), `an eave face leaves wall ${index}'s streaks as they are (seed ${seed})`)
        for (const sunlit of [true, false]) {
          assert.deepEqual(fadeBlotches(wall, HOUSE.floorY, WALL_TOP_Y, share, seed, sunlit, wall.openings, 1, eave), fadeBlotches(wall, HOUSE.floorY, WALL_TOP_Y, share, seed, sunlit), `an eave face leaves wall ${index}'s blotches as they are (seed ${seed})`)
        }
      }
    }
  }
  assert.equal(paintTopEdge('back', 'pitched')(0), WALL_TOP_Y, 'a pitched home\'s back wall tops out at the eave line')
  assert.equal(paintTopEdge('front', 'pitched')(0), WALL_TOP_Y, 'and so does its front wall')
  near(paintTopEdge('left', 'pitched')(0), roofUndersideY(0, 'pitched'), 1e-9, 'a gable wall tops out at the rake')
  for (const side of Object.keys(walls) as Side[]) {
    assert.equal(paintTopEdge(side, 'low-slope')(1), PARAPET_TOP, `a flat home's ${side} wall reaches the cap`)
  }
  // The eave walls of a pitched home draw what a wall with no face draws, with the same seeds and the same lists; and a wall with
  // no face (the house walls today, the foundation) keeps today's shaded rate, so today's patches stay where they were. Only a
  // shaded face reaching above the seam takes the raised rate.
  const back = STAIN_WALLS.find(each => each.side === 'back')!
  assert.equal(WEAR_LOOKS.paint.blotchesPerMetre.shaded, 0.15, 'a shaded wall keeps today\'s blotch rate')
  assert.deepEqual(fadeBlotches(back.wall, HOUSE.floorY, WALL_TOP_Y, 1, STAIN_SEEDS.blotches.back, false), [
    { size: [1.1705792812397702, 0.8692500656370676, 0], position: [2.703678083029981, 0.9643966528098321, -4.002] },
  ], 'the back wall\'s Worn blotches, with no face, are today\'s, in place')
  for (const share of [0.5, 1, 4 / 3]) {
    const pitched = paintedSurfaceStains('pitched', share, share)
    const backStreaks = pitched.walls.sides.streaks.filter(box => sideOf(box, 'pitched back') === 'back')
    assert.deepEqual(backStreaks, runoffStreaks(back.wall, HOUSE.floorY, WALL_TOP_Y, share, STAIN_SEEDS.streaks.back), 'the pitched back wall draws the streaks a wall with no face does')
    assert.deepEqual(pitched.walls.sides.blotches.filter(box => sideOf(box, 'pitched back') === 'back'), fadeBlotches(back.wall, HOUSE.floorY, WALL_TOP_Y, share, STAIN_SEEDS.blotches.back, back.sunlit), 'the pitched back wall draws the blotches a wall with no face does, at today\'s rate')
    assert.deepEqual(pitched.walls.front.streaks, runoffStreaks(FRONT_STAIN_WALL, HOUSE.floorY, WALL_TOP_Y, share, STAIN_SEEDS.streaks.front, FRONT_OPENINGS), 'the pitched front wall draws the streaks a wall with no face does')
    assert.deepEqual(pitched.walls.front.blotches, fadeBlotches(FRONT_STAIN_WALL, HOUSE.floorY, WALL_TOP_Y, share, STAIN_SEEDS.blotches.front, true, FRONT_OPENINGS), 'the pitched front wall draws the blotches a wall with no face does')
  }
  assert.deepEqual(STAIN_WALLS.map(({ side, sunlit }) => [side, sunlit]), [['back', false], ['left', true], ['right', false]], 'each wall takes the summer sun the house shell gives it')

  const emptyStains = { streaks: [], blotches: [] }
  for (const form of ['pitched', 'low-slope'] as const) {
    const none = paintedSurfaceStains(form, 0, 0)
    for (const face of [none.walls.sides, none.walls.front, none.gables.left, none.gables.right, none.parapets.kept, none.parapets.complete]) {
      assert.deepEqual(face, emptyStains, `${form}: None places no stain`)
    }
    const peelNone = roofPeeling(form, 0)
    for (const peeling of [peelNone.gables.left, peelNone.gables.right, ...peelNone.parapets.kept, ...peelNone.parapets.complete]) {
      assert.deepEqual(peeling, { bare: [], lifted: [] }, `${form}: None peels nothing`)
    }
    for (const share of [0.5, 1, 4 / 3]) {
      const label = `${form} at ${share.toFixed(2)}`
      const placed = paintedSurfaceStains(form, share, share)
      const other = form === 'pitched' ? [placed.parapets.kept, placed.parapets.complete] : [placed.gables.left, placed.gables.right]
      assert.ok(other.every(face => isDeepStrictEqual(face, emptyStains)), `${label}: the other form's lists are empty`)
      const uppers: [string, SurfaceStains][] = form === 'pitched'
        ? [['left gable', placed.gables.left], ['right gable', placed.gables.right]]
        : [['kept parapet', placed.parapets.kept], ['complete parapet', placed.parapets.complete]]

      for (const face of [placed.walls.sides, placed.walls.front]) {
        for (const kind of ['streaks', 'blotches'] as const) {
          for (const box of face[kind]) {
            const side = sideOf(box, `${label} wall ${kind}`)
            const [bottom, top] = span(box, 1)
            const along = alongOf(box, side)
            const where = `${label}: a ${side} wall ${kind} box (${along[0].toFixed(2)}..${along[1].toFixed(2)}, ${bottom.toFixed(3)}..${top.toFixed(3)})`
            assert.ok(top <= WALL_TOP_Y + eps, `${where} stays under the seam`)
            assert.ok(bottom >= HOUSE.floorY + (kind === 'streaks' ? 0.05 : 0) - eps, `${where} stays over the floor clearance`)
            for (const opening of openingsOf(side)) {
              assert.ok(clearOf(opening, along, [bottom, top]), `${where} keeps off the opening at ${opening.along}`)
            }
            if (form === 'pitched' && (side === 'left' || side === 'right')) {
              assert.ok(clearOf(vents[side], along, [bottom, top]), `${where} keeps off the vent`)
            }
            if (kind === 'streaks') {
              for (const opening of openingsOf(side).filter(each => each.sill > 0)) {
                const under = along[0] < opening.along + opening.width / 2 && along[1] > opening.along - opening.width / 2 && bottom < HOUSE.floorY + opening.head - eps
                assert.ok(!under || top <= HOUSE.floorY + opening.sill + eps, `${where}: a streak under the opening at ${opening.along} hangs from its sill`)
              }
            }
          }
        }
      }

      const upperRuns = new Map<Side, { streaks: StainBox[], blotches: StainBox[] }>()
      for (const [list, face] of uppers) {
        for (const kind of ['streaks', 'blotches'] as const) {
          for (const box of face[kind]) {
            const side = sideOf(box, `${label} ${list} ${kind}`)
            const [bottom, top] = span(box, 1)
            const along = alongOf(box, side)
            const where = `${label}: a ${list} ${kind} box on the ${side} (${along[0].toFixed(2)}..${along[1].toFixed(2)}, ${bottom.toFixed(3)}..${top.toFixed(3)})`
            assert.ok(box.size[1] > 0 && along[1] > along[0], `${where} has a width and a height`)
            assert.ok(bottom >= WALL_TOP_Y - eps, `${where} stays over the seam`)
            if (form === 'pitched') {
              assert.equal(side, list.startsWith('left') ? 'left' : 'right', `${where} lies on its own gable`)
              assert.ok(top <= roofUndersideY(along[0], 'pitched') + eps && top <= roofUndersideY(along[1], 'pitched') + eps, `${where} stays under the rake`)
              assert.ok(along[0] >= -HOUSE.halfDepth - eps && along[1] <= HOUSE.halfDepth + eps, `${where} stays within the gable's run`)
              assert.ok(clearOf(vents[side as 'left' | 'right'], along, [bottom, top]), `${where} keeps off the vent`)
            }
            else {
              assert.ok(top <= PARAPET_TOP + eps, `${where} stays under the cap`)
              const kept = list.startsWith('kept')
              assert.ok(kept ? side !== 'front' : side === 'front' || side === 'left', `${where} lifts with its own half of the parapet`)
              if (side === 'left') {
                assert.ok(kept ? along[1] <= LEFT_PARAPET_CUT + eps : along[0] >= LEFT_PARAPET_CUT - eps, `${where} lies on its side of the left parapet's cut`)
              }
            }
            const entry = upperRuns.get(side) ?? { streaks: [], blotches: [] }
            entry[kind].push(box)
            upperRuns.set(side, entry)
          }
        }
      }
      // The left parapet's two halves of one cut stain show its two sides of the atlas cell.
      if (form === 'low-slope') {
        for (const kind of ['streaks', 'blotches'] as const) {
          const kept = placed.parapets.kept[kind].filter(box => sideOf(box, label) === 'left' && Math.abs(alongOf(box, 'left')[1] - LEFT_PARAPET_CUT) < eps)
          for (const box of kept) {
            const twin = placed.parapets.complete[kind].filter(each => sideOf(each, label) === 'left' && Math.abs(alongOf(each, 'left')[0] - LEFT_PARAPET_CUT) < eps
              && Math.abs(each.position[1] - box.position[1]) < eps && Math.abs(each.size[1] - box.size[1]) < eps)
            assert.equal(twin.length, 1, `${label}: a ${kind} box cut at the left parapet's cut has one other half`)
            const [behind, before] = [box.u ?? [0, 1], twin[0].u ?? [0, 1]]
            assert.ok(Math.abs(behind[1] - before[0]) < eps || Math.abs(behind[0] - before[1]) < eps, `${label}: the cut ${kind} halves' u ranges meet`)
          }
        }
      }

      // The halves line up across the seam.
      const pairs = new Map<Side, number>()
      for (const kind of ['streaks', 'blotches'] as const) {
        for (const box of [...placed.walls.sides[kind], ...placed.walls.front[kind]]) {
          const [, top] = span(box, 1)
          if (Math.abs(top - WALL_TOP_Y) > eps || (box.v?.[1] ?? 1) >= 1) {
            continue
          }
          const side = sideOf(box, label)
          const along = alongOf(box, side)
          const above = (upperRuns.get(side)?.[kind] ?? []).filter(each => Math.abs(span(each, 1)[0] - WALL_TOP_Y) < eps
            && alongOf(each, side)[0] >= along[0] - eps && alongOf(each, side)[1] <= along[1] + eps)
          const cut = form === 'low-slope' && side === 'left' && along[0] < LEFT_PARAPET_CUT - eps && along[1] > LEFT_PARAPET_CUT + eps
          const where = `${label}: the ${side} wall's ${kind} box at ${along[0].toFixed(2)}..${along[1].toFixed(2)}`
          if (cut) {
            assert.equal(above.length, 2, `${where} carries on above the seam, in the parapet's two halves`)
            const spans = above.map(each => alongOf(each, side)).sort((a, b) => a[0] - b[0])
            assert.ok(Math.abs(spans[0][0] - along[0]) < eps && Math.abs(spans[0][1] - LEFT_PARAPET_CUT) < eps && Math.abs(spans[1][0] - LEFT_PARAPET_CUT) < eps && Math.abs(spans[1][1] - along[1]) < eps, `${where}: its two upper halves cover its span`)
          }
          else {
            assert.equal(above.length, 1, `${where} carries on above the seam in one box`)
            const [start, end] = alongOf(above[0], side)
            assert.ok(Math.abs(start - along[0]) < eps && Math.abs(end - along[1]) < eps, `${where}: its upper half has its along span`)
          }
          for (const each of above) {
            near(each.v?.[0] ?? 0, box.v?.[1] ?? 1, eps, `${where}: its upper half's v starts where its own ends`)
          }
          if (kind === 'streaks') {
            pairs.set(side, (pairs.get(side) ?? 0) + 1)
          }
        }
      }
      const runs: Side[] = form === 'pitched' ? ['left', 'right'] : ['back', 'left', 'right', 'front']
      if (share === 1) {
        for (const run of runs) {
          assert.ok((pairs.get(run) ?? 0) > 0, `${label}: the ${run} ${form === 'pitched' ? 'gable' : 'parapet'} has a streak running down across the seam`)
          assert.ok((upperRuns.get(run)?.blotches.length ?? 0) > 0, `${label}: the ${run} ${form === 'pitched' ? 'gable' : 'parapet'} has a blotch above the seam at the Worn look`)
        }
        if (form === 'pitched') {
          for (const side of ['left', 'right'] as const) {
            const hung = (upperRuns.get(side)?.streaks ?? []).some((box) => {
              const [start, end] = alongOf(box, side)
              const [, top] = span(box, 1)
              return start >= vents[side].along - vents[side].width / 2 - eps && end <= vents[side].along + vents[side].width / 2 + eps
                && top <= ventBottom + eps && top > ventBottom - 0.05
            })
            assert.ok(hung, `${label}: the ${side} gable has a streak hanging from just under its vent`)
          }
        }
      }
    }

    // More share keeps what less placed, run by run.
    const [moderate, heavy] = [paintedSurfaceStains(form, 1, 1), paintedSurfaceStains(form, 4 / 3, 4 / 3)]
    const faces = (placed: typeof moderate) => form === 'pitched' ? [placed.gables.left, placed.gables.right] : [placed.parapets.kept, placed.parapets.complete]
    for (const [index, face] of faces(moderate).entries()) {
      const more = faces(heavy)[index]
      for (const side of Object.keys(walls) as Side[]) {
        const lower = face.streaks.filter(box => sideOf(box, form) === side)
        const higher = more.streaks.filter(box => sideOf(box, form) === side)
        assert.deepEqual(lower, higher.slice(0, lower.length), `${form}: Moderate's ${side} upper streaks are Heavy's first ones, in place`)
      }
    }

    // Peeling joins the gables and the parapets, inside each face.
    const extent = (box: BoxSpec, axis: 0 | 1 | 2): readonly [number, number] => {
      const turn = new Euler(...(box.rotation ?? [0, 0, 0]))
      const corner = (x: number, y: number, z: number) => new Vector3(x * box.size[0] / 2, y * box.size[1] / 2, z * box.size[2] / 2).applyEuler(turn).getComponent(axis)
      const reaches = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => corner(x, y, z))))
      return [box.position[axis] + Math.min(...reaches), box.position[axis] + Math.max(...reaches)]
    }
    // A patch or flake is thinnest across its own wall.
    const peelSide = (box: BoxSpec): Side => box.size[0] < box.size[2] ? (box.position[0] < 0 ? 'left' : 'right') : (box.position[2] < 0 ? 'back' : 'front')
    let peeled = 0
    for (const share of [0.5, 1, 4 / 3]) {
      const peel = roofPeeling(form, share)
      const lists: [string, PeelingBoxes][] = form === 'pitched'
        ? [['left gable', peel.gables.left], ['right gable', peel.gables.right]]
        : [...peel.parapets.kept.map(each => ['kept parapet', each] as [string, PeelingBoxes]), ...peel.parapets.complete.map(each => ['complete parapet', each] as [string, PeelingBoxes])]
      if (form === 'low-slope') {
        assert.ok(isDeepStrictEqual(roofPeeling(form, share).gables, { left: { bare: [], lifted: [] }, right: { bare: [], lifted: [] } }), `${form}: a flat roof has no gable peeling`)
      }
      else {
        assert.equal(peel.parapets.kept.length + peel.parapets.complete.length, 0, 'a pitched roof has no parapet peeling')
      }
      for (const [list, peeling] of lists) {
        for (const box of [...peeling.bare, ...peeling.lifted]) {
          const side = peelSide(box)
          const [alongAxis] = axesOf(walls[side])
          const along = extent(box, alongAxis)
          const [bottom, top] = extent(box, 1)
          const where = `${form} at ${share.toFixed(2)}: a ${list} peeling box on the ${side} (${along[0].toFixed(2)}..${along[1].toFixed(2)}, ${bottom.toFixed(3)}..${top.toFixed(3)})`
          const edge = paintTopEdge(side, form)
          assert.ok(bottom >= WALL_TOP_Y - eps, `${where} stays over the seam`)
          assert.ok(top <= edge(along[0]) + eps && top <= edge(along[1]) + eps, `${where} stays under the top edge`)
          assert.ok(along[0] >= walls[side].from - eps && along[1] <= walls[side].to + eps, `${where} stays within its wall's run`)
          if (form === 'pitched') {
            assert.equal(side, list.startsWith('left') ? 'left' : 'right', `${where} lies on its own gable`)
            assert.ok(clearOf(vents[side as 'left' | 'right'], along, [bottom, top]), `${where} keeps off the vent`)
          }
          else if (side === 'left') {
            assert.ok(list.startsWith('kept') ? along[1] <= LEFT_PARAPET_CUT + eps : along[0] >= LEFT_PARAPET_CUT - eps, `${where} lies on its side of the left parapet's cut`)
          }
          else {
            assert.equal(list.startsWith('kept'), side !== 'front', `${where} lifts with its own half of the parapet`)
          }
          peeled++
        }
      }
    }
    const [lowPeel, highPeel] = [roofPeeling(form, 1), roofPeeling(form, 4 / 3)]
    const peelings = (peel: typeof lowPeel) => [peel.gables.left, peel.gables.right, ...peel.parapets.kept, ...peel.parapets.complete]
    for (const [index, low] of peelings(lowPeel).entries()) {
      const high = peelings(highPeel)[index]
      for (const list of ['bare', 'lifted'] as const) {
        assert.deepEqual(low[list], high[list].slice(0, low[list].length), `${form}: Moderate's ${list} peeling ${index} is Heavy's first, in place`)
      }
    }
    // Water collects at the ground, so a raised face has no foot: its patches do not line up on the seam. 25 cm is the foot's reach plus a margin; the vent's own sill cluster
    // sits a little higher on the left gable, and is not the seam.
    for (const share of [1, 4 / 3]) {
      const placed = roofPeeling(form, share)
      for (const [list, peeling] of (form === 'pitched' ? [['left gable', placed.gables.left], ['right gable', placed.gables.right]] : []) as [string, PeelingBoxes][]) {
        const nearSeam = peeling.bare.filter(box => extent(box, 1)[0] < WALL_TOP_Y + 0.25).length
        assert.ok(nearSeam * 2 < peeling.bare.length, `${form} at ${share.toFixed(2)}: ${nearSeam} of ${peeling.bare.length} bare patches on the ${list} start within 25 cm of the seam, fewer than half`)
      }
    }
    assert.ok(peeled > 0, `${form}: the roof's painted faces peel`)
  }

  // The merge carries a box's share of its atlas cell.
  const [streak] = runoffStreaks(HOUSE_WALLS.back, HOUSE.floorY, WALL_TOP_Y, 1, 21)
  const top = streak.position[1] + streak.size[1] / 2
  const lowered = mergeStainBoxes([{ cell: 'streak', boxes: [{ ...streak, v: [0.25, 1] }], color: '#906040', alpha: 0.25 }])
  assert.ok(lowered, 'a box with a v merges')
  const [loweredUv, loweredPosition] = [lowered.getAttribute('uv'), lowered.getAttribute('position')]
  for (let vertex = 0; vertex < loweredUv.count; vertex++) {
    assert.ok(loweredUv.getY(vertex) >= 0.25 - 1e-6 && loweredUv.getY(vertex) <= 1 + 1e-6, 'a box\'s vertex v stays within its own v')
  }
  // BoxGeometry's last twelve vertices are the two faces looking along z, a back-wall stain's own.
  for (let vertex = 24; vertex < 36; vertex++) {
    if (Math.abs(loweredPosition.getY(vertex) - top) < 1e-6) {
      near(loweredUv.getY(vertex), 1, 1e-6, 'the stain face\'s top vertices stay at v = 1')
    }
  }
  lowered.dispose()
  const halved = mergeStainBoxes([{ cell: 'blotch', boxes: [{ ...streak, u: [0, 0.5] }], color: '#ffffff', alpha: 0.4 }])
  assert.ok(halved, 'a box with a u merges')
  const [from, to] = STAIN_CELL_U.blotch
  const halvedUv = halved.getAttribute('uv')
  for (let vertex = 0; vertex < halvedUv.count; vertex++) {
    assert.ok(halvedUv.getX(vertex) >= from - 1e-6 && halvedUv.getX(vertex) <= from + (to - from) / 2 + 1e-6, 'a box with u [0, 0.5] keeps to the first half of its cell')
  }
  halved.dispose()

  // Today's seeds cut no stain at the left parapet's cut, so the cut is checked on a blotch laid across it: its halves meet there,
  // and the atlas shows the same point of the shape either side of it on the face looking out.
  const left = STAIN_WALLS.find(each => each.side === 'left')!.wall
  const across = { size: [0, 0.6, 1.2], position: [left.line + left.outward * stainFace, WALL_TOP_Y + 0.4, LEFT_PARAPET_CUT + 0.2], v: [0.3, 1] } as const satisfies StainBox
  const { before, after } = splitAlong([across], LEFT_PARAPET_CUT)
  assert.equal(before.length + after.length, 2, 'a stain across the left parapet\'s cut becomes two')
  near(span(before[0], 2)[1], LEFT_PARAPET_CUT, eps, 'the half behind ends at the cut')
  near(span(after[0], 2)[0], LEFT_PARAPET_CUT, eps, 'the half in front starts at the cut')
  assert.deepEqual([before[0].v, after[0].v], [across.v, across.v], 'a cut across the run keeps the box\'s v')
  const uAtCut = (box: StainBox) => {
    const merged = mergeStainBoxes([{ cell: 'blotch', boxes: [box], color: '#ffffff', alpha: 1 }])!
    const [position, uv] = [merged.getAttribute('position'), merged.getAttribute('uv')]
    // BoxGeometry's vertices 6 to 11 are the face looking toward −x, the left wall's outside.
    const us = Array.from({ length: 6 }, (_, index) => index + 6).filter(vertex => Math.abs(position.getZ(vertex) - LEFT_PARAPET_CUT) < 1e-6).map(vertex => uv.getX(vertex))
    merged.dispose()
    return us
  }
  const [behindU, aheadU] = [uAtCut(before[0]), uAtCut(after[0])]
  assert.ok(behindU.length > 0 && aheadU.length > 0, 'both halves have vertices at the cut')
  for (const u of [...behindU, ...aheadU]) {
    near(u, behindU[0], 1e-6, 'the cut halves show the same point of the atlas either side of the cut')
  }
  const seamed = splitAtSeam([{ ...across, position: [across.position[0], WALL_TOP_Y, across.position[2]] }], WALL_TOP_Y)
  assert.equal(seamed.below.length + seamed.above.length, 2, 'a stain across the seam becomes two')
  near(seamed.below[0].v![0], 0.3, eps, 'the lower half keeps the box\'s own v from its foot')
  near(seamed.below[0].v![1], 0.65, eps, 'and the halves meet halfway up the box\'s own v')
  near(seamed.above[0].v![0], 0.65, eps, 'the upper half starts where the lower one ends')
  near(seamed.above[0].v![1], 1, eps, 'and runs to the box\'s own top')
  near(span(seamed.below[0], 1)[1], WALL_TOP_Y, eps, 'the lower half ends at the seam')
  near(span(seamed.above[0], 1)[0], WALL_TOP_Y, eps, 'the upper half starts at the seam')
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
const targetsOf = (state: TradeSceneInputs) => resolveScene(state, cuts, YEAR)
const slotsOf = (state: TradeSceneInputs) => sceneChangeSlots(state, targetsOf(state), YEAR)
const top = (state: TradeSceneInputs, q: string) => searchSceneChanges(slotsOf(state), q)[0]
assert.equal(top(base, 'tile')?.slot.id, 'roof')
assert.equal(top(base, 'tile')?.hit, 'tile')
const atticSlot = slotsOf(base).find(s => s.id === 'attic-insulation')!
assert.deepEqual(atticSlot.options.map(o => o.label), insulationLevels.map(level => INSULATION_LEVEL_LABELS[level]), 'the attic slot reads the core labels')
for (const query of ['r-30', 'r30', '10 in']) {
  assert.ok(searchSceneChanges(slotsOf(base), query).some(r => r.slot.id === 'attic-insulation'), `"${query}" finds the attic insulation slot`)
}
assert.equal(top(base, 'r-30')?.hit, 'r30', '"r-30" picks the R-30 level')
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
{
  const repairsBase = inputs({ homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } } })
  const step = (state: TradeSceneInputs, perYear: number | null) => ({ ...state, ...applySceneChange(state, { kind: 'repairs', trade: 'roof-and-gutters', perYear }, YEAR) })
  const typed = step(repairsBase, 900)
  assert.equal(typed.repairsOverrides['roof-and-gutters'], 900)
  assert.equal(step(typed, 0).repairsOverrides['roof-and-gutters'], 0, 'a typed 0 is kept')
  assert.equal(step(typed, null).repairsOverrides['roof-and-gutters'], null, 'cleared goes back to the working figure')
  const noGas = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: { ...BILLS, gas: { now: 0, cut: { mode: 'trades', value: null } } } }), cuts).savings
  assert.equal(noGas.cuts.gas.bill, 0, 'a typed $0 gas bill stays $0, not the area default')
  assert.equal(noGas.cuts.gas.after, 0)
}
assert.deepEqual(applyAll(base, [{ kind: 'household', patch: { type: 'Family' } }]).household, { type: 'Family', ageGroup: null })
assert.equal(applyAll(base, [{ kind: 'bill', category: 'gas', now: 140 }]).bills.gas.now, 140)
assert.equal(applyAll(base, [{ kind: 'bill', category: 'gas', now: 140 }, { kind: 'bill', category: 'gas', now: null }]).bills.gas.now, null, 'a cleared bill goes back to the climate default')
assert.deepEqual(applyAll(base, [{ kind: 'efficiency-upgrade', upgrade: 'r8-ducts', on: true }]).efficiencyUpgrades, ['cool-roof', 'cool-paint', 'r8-ducts'])
const waterBasedState = { ...base, property: regularHome, efficiencyUpgrades: ['cool-roof'] as EfficiencyUpgradeId[], proposedScopeIds: [SCOPE_IDS.waterBasedRepaint] }
const switchedOn = applyAll(waterBasedState, [{ kind: 'efficiency-upgrade', upgrade: 'cool-paint', on: true }])
assert.ok(switchedOn.proposedScopeIds.includes(SCOPE_IDS.coolLifeRepaint) && !switchedOn.proposedScopeIds.includes(SCOPE_IDS.waterBasedRepaint), 'switching Cool Life paint on swaps the pick in the same write')
const switchedOff = applyAll(switchedOn, [{ kind: 'efficiency-upgrade', upgrade: 'cool-paint', on: false }])
assert.ok(switchedOff.proposedScopeIds.includes(SCOPE_IDS.waterBasedRepaint) && !switchedOff.proposedScopeIds.includes(SCOPE_IDS.coolLifeRepaint), 'and switching it off swaps it back')
const coolHome = applyAll(waterBasedState, [{ kind: 'option', field: 'exteriorPaint', value: 'cool' }])
assert.ok(coolHome.proposedScopeIds.includes(SCOPE_IDS.coolLifeRepaint) && !coolHome.proposedScopeIds.includes(SCOPE_IDS.waterBasedRepaint), 'a home set to Cool Life paint repaints with Cool Life in the same write')
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
const noCoolPaint = { ...base, efficiencyUpgrades: base.efficiencyUpgrades.filter(upgrade => upgrade !== 'cool-paint') }
const coolPaintOf = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'upgrade:cool-paint')
assert.equal(coolPaintOf(base)?.unavailable, 'Preview a repaint to add Cool Life paint.', 'Cool Life paint stays listed before a repaint is picked')
const repaintOption = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'build:paint')!.options.filter(o => o.value !== 'no-change')
assert.deepEqual(repaintOption(base).map(o => [o.value, o.label]), [[SCOPE_IDS.coolLifeRepaint, 'Repaint']], 'one Repaint option, the Cool Life scope by default')
const repainted = applyAll(base, [slotsOf(base).find(s => s.id === 'build:paint')!.change(SCOPE_IDS.coolLifeRepaint)])
assert.deepEqual([coolPaintOf(repainted)?.unavailable, coolPaintOf(repainted)?.current], [null, 'on'], 'a repaint takes Cool Life paint, on by default')
const paintSwitchedOff = applyAll(repainted, [coolPaintOf(repainted)!.change('off')])
assert.deepEqual([paintSwitchedOff.efficiencyUpgrades.includes('cool-paint'), paintSwitchedOff.proposedScopeIds.includes(SCOPE_IDS.waterBasedRepaint)], [false, true], 'off, the repaint is the water-based scope')
assert.deepEqual(repaintOption(paintSwitchedOff).map(o => o.label), ['Repaint'], 'and still reads Repaint')
const coolPainted = applyAll(noCoolPaint, [{ kind: 'option', field: 'exteriorPaint', value: 'cool' }])
assert.deepEqual(paintRow(coolFacts, [], []).scopeIds, [SCOPE_IDS.coolLifeRepaint], 'a Cool Life home is offered only the Cool Life repaint')
assert.deepEqual(repaintOption(coolPainted).map(o => o.value), [SCOPE_IDS.coolLifeRepaint], 'and its one Repaint option is that scope')
assert.equal(coolPaintOf(applyAll(coolPainted, [slotsOf(coolPainted).find(s => s.id === 'build:paint')!.change(repaintOption(coolPainted)[0]!.value)])), undefined, 'a Cool Life home shows no Cool Life switch')
assert.deepEqual([CONTROLS_COPY.systems.buildChips.paint.add, CONTROLS_COPY.systems.buildChips.paint.short()], ['Repaint', 'Repaint'], 'the repaint never names Cool Life, which may be off')
assert.equal(EFFICIENCY_UPGRADE_LABELS['cool-paint'], 'Cool Life paint')
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

// The gables, the parapets and the wall draw their stains from one layout, each on the same shares, so the halves line up.
{
  const kit = (file: string) => readFileSync(join('src/features/trade-scenes/ui/components/home-kit', file), 'utf8')
  const groupsOf = (source: string, marker: string) => source.split(marker).slice(1).map(part => part.slice(0, part.indexOf('</group>')))
  const gableSource = kit('gable-roof.tsx')
  const lowSlopeSource = kit('low-slope-roof.tsx')
  const shellSource = kit('house-shell.tsx')
  const gableGroups = groupsOf(gableSource, 'userData={thermalTag(LEFT_GABLE_ZONE)}').concat(groupsOf(gableSource, 'userData={thermalTag(RIGHT_GABLE_ZONE)}'))
  assert.equal(gableGroups.length, 2)
  assert.ok(gableGroups.every(group => group.includes('<PaintStains')), 'each gable draws its stains in its own group')
  const keptGroup = lowSlopeSource.slice(lowSlopeSource.indexOf('<PaintMarks lists={marks.kept}'), lowSlopeSource.indexOf('</group>', lowSlopeSource.indexOf('<PaintMarks lists={marks.kept}')))
  const completeGroup = lowSlopeSource.slice(lowSlopeSource.indexOf('<PaintMarks lists={marks.complete}'), lowSlopeSource.indexOf('</group>', lowSlopeSource.indexOf('<PaintMarks lists={marks.complete}')))
  assert.ok(keptGroup.includes('<PaintStains') && completeGroup.includes('<PaintStains'), 'the kept and the complete parapets each draw their stains')
  assert.ok(shellSource.includes('surfaceStainLists') && !shellSource.includes('onWalls'), 'the house shell builds its stain lists from the shared layout')
  for (const [name, source] of [['house-shell', shellSource], ['gable-roof', gableSource], ['low-slope-roof', lowSlopeSource]] as const) {
    assert.ok(source.includes('stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]'), `${name} takes the stain share as the shell does`)
    assert.ok(source.includes('fadeShare = wornShare(paint.wear)'), `${name} takes the fade share as the shell does`)
  }
}

{
  assert.deepEqual(REMODEL_ROI_CONFIG_DEFAULTS.defaultRatesPercent, BILL_GROWTH_RATES_PERCENT, 'the calculator reads the core rates')
  assert.equal(REMODEL_ROI_CONFIG_DEFAULTS.defaultConstructionPercent, CONSTRUCTION_GROWTH_RATE_PERCENT)
  const billYears = projectBillYears({ electric: { now: 300, after: 213.75 } }, { electric: 7.57 }, 3)
  assert.equal(billYears.length, 4)
  assert.deepEqual(billYears[0], { t: 0, billsNow: { electric: 0 }, billsAfter: { electric: 0 } })
  near(billYears[1].billsNow.electric, 300, 1e-9, 'year 1 is today\'s bill')
  near(billYears[3].billsAfter.electric, 213.75 * 1.0757 ** 2, 1e-9, 'year 3 compounds twice')
  const form = createRemodelRoiDefaults(roiConfig)
  form.bills.electric = { now: 300, cut: { mode: 'trades', value: null } }
  const years = projectRemodelRoi(form, roiConfig).years
  near(years[5].billsNowByCategory.electric, 300 * 1.0757 ** 4, 1e-9, 'the calculator\'s year 5 is unchanged')
}

// ── The upgrade registry ───────────────────────────────────────────────────────
{
  const placeholder = /\{(?:material|rValue)\}/
  for (const scopeId of Object.values(SCOPE_IDS)) {
    const entry = UPGRADE_REGISTRY[scopeId]
    assert.ok(entry.benefits.length > 0, `${entry.name}: at least one statement`)
    for (const benefit of entry.benefits) {
      for (const text of [benefit.title, benefit.detail]) {
        assert.ok(!/\byour\b/i.test(text) && !/solar/i.test(text), `${entry.name}: copy rules`)
        for (const upgrade of [null, ...EFFICIENCY_UPGRADE_IDS]) {
          assert.ok(!placeholder.test(fillBenefitText(text, installedMaterial(scopeId, upgrade ? [upgrade] : []))), `${entry.name}: every placeholder fills`)
        }
      }
      for (const upgrade of [benefit.onlyWith, benefit.onlyWithout].filter(id => id !== undefined)) {
        assert.ok(offersEfficiencyUpgrade([scopeId], upgrade), `${entry.name}: ${upgrade} applies to this upgrade`)
      }
    }
  }
  for (const scopeId of [SCOPE_IDS.atticInsulationReplacement, SCOPE_IDS.atticInsulationTopOff]) {
    const filled = fillBenefitText(UPGRADE_REGISTRY[scopeId].benefits[0].detail, installedMaterial(scopeId, []))
    assert.ok(filled.includes(`R-${installedMaterial(scopeId, []).thermal?.rValue}`), 'the insulation statement names the R-value installed')
  }
  assert.equal(UPGRADE_REGISTRY[SCOPE_IDS.roofTileReset].benefits.some(benefit => benefit.kind === 'warranty'), false, 'the tile reset carries no warranty line')
  assert.notEqual(installedMaterial(SCOPE_IDS.roofTearOff, ['cool-roof']), installedMaterial(SCOPE_IDS.roofTearOff, []), 'the cool roof swaps the covering')
  assert.equal(fillBenefitText('{material}|{rValue}', installedMaterial(SCOPE_IDS.atticInsulationReplacement, [])), 'R-30 blown-in insulation|R-30')
  assert.equal(fillBenefitText('{material}|{rValue}', installedMaterial(SCOPE_IDS.atticInsulationReplacement, ['r38-insulation'])), 'R-38 blown-in insulation|R-38', 'the R-38 step swaps the replace to R-38')
}

// ── The build's benefit lines ──────────────────────────────────────────────────
{
  const roofOnlyWorn = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': 'worn', 'windows': 'new', 'exterior-paint': 'new', 'heating-cooling': 'new' } } } as const
  const shingle = profile({ roofType: 'shingle' })
  const facts = { property: shingle, materials: roofOnlyWorn.homeMaterials, year: currentYear() }
  const roofAndAttic = [TEAR_OFF, ATTIC_REPLACEMENT, RADIANT_BARRIER]
  const picks = pickedUpgrades(facts, roofAndAttic, ['cool-roof'])
  assert.deepEqual(picks.roof, [TEAR_OFF])
  assert.deepEqual(picks.attic, [RADIANT_BARRIER, ATTIC_REPLACEMENT], 'in the Upgrades list\'s order')

  const scene = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: roofAndAttic, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
  const bySystem = systemCuts(scene.savings)
  for (const category of SAVINGS_CATEGORIES) {
    const kept = Object.values(bySystem).reduce((product, cut) => product * (1 - (cut[category]?.percent ?? 0) / 100), 1)
    near(1 - kept, scene.savings.cuts[category].combined, 1e-12, `${category}: the systems' cuts compound to the build's`)
  }

  const lines = buildBenefits({ facts, picks, savings: scene.savings, repairs: repairsRows(shingle, scene.home), efficiencyUpgrades: ['cool-roof'] })
  assert.ok(lines.some(line => line.system === 'roof' && line.kind === 'warranty' && line.title === 'Owens Corning Duration COOL'), 'onlyWith cool-roof shows with it on')
  assert.ok(!lines.some(line => line.title === 'New shingles'), 'onlyWithout cool-roof hides with it on')
  const upkeep = lines.find(line => line.system === 'roof' && line.title === 'Roof upkeep ends')!
  assert.equal(upkeep.detail, 'Keeping up the old roof costs about $400 a year (Worn). The new one starts that at zero.')
  assert.equal(upkeep.figure, 33)
  assert.equal(lines.find(line => line.system === 'roof' && line.kind === 'savings' && line.from === null && line !== upkeep)!.title, 'Electric about 8% lower')
  assert.ok(lines.some(line => line.system === 'roof' && line.kind === 'planet' && line.soon))

  const noGas = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: [ATTIC_REPLACEMENT], bills: { ...BILLS, gas: { now: 0, cut: { mode: 'trades', value: null } } } }), cuts)
  const noGasLines = buildBenefits({ facts, picks: pickedUpgrades(facts, [ATTIC_REPLACEMENT], []), savings: noGas.savings, repairs: repairsRows(shingle, noGas.home), efficiencyUpgrades: [] })
  assert.ok(noGasLines.every(line => !/gas/i.test(line.title)), 'a $0 gas bill earns no gas claim')

  const repaint = resolveScene(inputs({ view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], bills: BILLS }), cuts)
  const repaintFacts = { property: HOME_SCENE_DEFAULTS.property, materials: HOME_SCENE_DEFAULTS.homeMaterials, year: currentYear() }
  const likeForLike = buildBenefits({ facts: repaintFacts, picks: pickedUpgrades(repaintFacts, [SCOPE_IDS.waterBasedRepaint], []), savings: repaint.savings, repairs: repairsRows(HOME_SCENE_DEFAULTS.property, repaint.home), efficiencyUpgrades: [] })
  assert.ok(!likeForLike.some(line => line.kind === 'planet'), 'a like-for-like build has no Planet dot')
  assert.ok(likeForLike.some(line => line.title === 'Paint upkeep ends'), 'its upkeep still ends')

  const atticOnly = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: [ATTIC_REPLACEMENT, RADIANT_BARRIER], bills: BILLS }), cuts)
  const atticLines = buildBenefits({ facts, picks: pickedUpgrades(facts, [ATTIC_REPLACEMENT, RADIANT_BARRIER], []), savings: atticOnly.savings, repairs: repairsRows(shingle, atticOnly.home), efficiencyUpgrades: [] })
  assert.equal(atticLines.find(line => line.system === 'attic' && line.kind === 'savings' && line.from === null)!.title, 'Electric about 15%, gas about 17% lower')

  for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
    const system = HOME_SYSTEMS.find(({ id }) => Object.entries(pickedUpgrades(facts, [scopeId], [])).some(([key, ids]) => key === id && ids.includes(scopeId as never)))?.id
    if (system) {
      assert.equal(TRADE_SYSTEM[entry!.trade], system, `${scopeId}: its trade's system is where the Upgrades list files it`)
    }
  }
  for (const assembly of Object.values(ASSEMBLIES)) {
    for (const part of assembly.parts) {
      for (const material of Object.values(part.materials)) {
        if (material.cut) {
          const system = HOME_SYSTEMS.find(({ rows }) => rows.some(row => row.assembly === assembly.id && row.part === part.id))?.id
          assert.equal(ADD_ON_SYSTEM[material.cut], system, `${material.cut}: the add-on's system is its part's`)
        }
      }
    }
  }
}

// ── Today's costs and the two futures ──────────────────────────────────────────
{
  assert.equal(yearLabel(1, 2026), 'Now')
  assert.equal(yearLabel(5, 2026), '2031')
  assert.equal(yearLabel(10, 2026), '2036')
  const today = { electric: 300, gas: 120, repairs: 50, total: 470 }
  const after = { electric: 210, gas: 120, repairs: 0, total: 330 }
  const now = futureYear(today, after, 1)
  assert.deepEqual(now.without, today, 'year 1 is today')
  assert.equal(now.saves, 140)
  const year5 = futureYear(today, after, 5)
  assert.equal(year5.without.electric, Math.round(300 * 1.0757 ** 4), 'electric at its rate, in whole dollars')
  assert.equal(year5.without.gas, Math.round(120 * 1.091 ** 4), 'gas at its rate, in whole dollars')
  assert.equal(year5.without.repairs, Math.round(50 * 1.05 ** 4), 'upkeep at the construction rate, in whole dollars')
  // Every year reads as it is shown: whole-dollar parts, totals their sums, the saving the totals' difference.
  for (let year = 1; year <= 10; year++) {
    const shown = futureYear(today, after, year)
    for (const side of [shown.without, shown.with]) {
      assert.ok([side.electric, side.gas, side.repairs].every(Number.isInteger), `year ${year}: whole-dollar parts`)
      assert.equal(side.total, side.electric + side.gas + side.repairs, `year ${year}: the total is its parts`)
    }
    assert.equal(shown.saves, shown.without.total - shown.with.total, `year ${year}: the saving is the totals' difference`)
  }
  const form = createRemodelRoiDefaults(roiConfig)
  form.bills.electric = { now: 300, cut: { mode: 'trades', value: null } }
  form.bills.gas = { now: 120, cut: { mode: 'trades', value: null } }
  const calculatorYear5 = projectRemodelRoi(form, roiConfig).years[5]
  assert.equal(Math.round(calculatorYear5.billsNowByCategory.electric), year5.without.electric, 'year 5 electric matches the calculator\'s')
  assert.equal(Math.round(calculatorYear5.billsNowByCategory.gas), year5.without.gas, 'year 5 gas matches the calculator\'s')

  const roofOnlyWorn = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': 'worn', 'windows': 'new', 'exterior-paint': 'new', 'heating-cooling': 'new' } } } as const
  const shingle = profile({ roofType: 'shingle' })
  const costsFor = (proposedScopeIds: string[], repairsOverrides: TradeSceneInputs['repairsOverrides'] = {}) => {
    const scene = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds, bills: BILLS, repairsOverrides }), cuts)
    const rows = repairsRows(shingle, scene.home)
    return { today: todayCosts(scene.savings, rows, repairsOverrides), after: afterCosts(scene.savings, rows, repairsOverrides) }
  }
  const tearOff = costsFor([TEAR_OFF])
  assert.equal(tearOff.today.repairs, 33)
  assert.equal(tearOff.today.total, 300 + 120 + 33)
  assert.equal(tearOff.after.repairs, 0, 'a tear-off ends the roof\'s upkeep')
  assert.equal(costsFor([TEAR_OFF], { 'roof-and-gutters': 0 }).today.repairs, 0, 'a typed $0 stays $0')
  const guttersOnly = costsFor([GUTTERS])
  assert.equal(guttersOnly.after.repairs, 33, 'gutters alone keep the roof\'s upkeep')
  for (const costs of [tearOff, guttersOnly]) {
    assert.equal(futureYear(costs.today, costs.after, 1).saves, costs.today.total - costs.after.total, 'one saving figure')
  }
}

// ── The rail's groups and header ───────────────────────────────────────────────
{
  const roofOnlyWorn = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': 'worn', 'windows': 'new', 'exterior-paint': 'new', 'heating-cooling': 'new' } } } as const
  const shingle = profile({ roofType: 'shingle' })
  const facts = { property: shingle, materials: roofOnlyWorn.homeMaterials, year: currentYear() }
  const roofAndAttic = [TEAR_OFF, ATTIC_REPLACEMENT, RADIANT_BARRIER]
  const scene = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: roofAndAttic, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
  const repairs = repairsRows(shingle, scene.home)
  const lines = buildBenefits({ facts, picks: pickedUpgrades(facts, roofAndAttic, ['cool-roof']), savings: scene.savings, repairs, efficiencyUpgrades: ['cool-roof'] })
  const savingNow = futureYear(todayCosts(scene.savings, repairs, {}), afterCosts(scene.savings, repairs, {}), 1).saves

  const roof = railGroups(lines, { type: 'system', system: 'roof' }, savingNow)
  assert.ok(roof.header.startsWith('Roof & gutters · '), roof.header)
  assert.deepEqual(roof.groups.map(group => group.id), BENEFIT_KINDS.filter(kind => lines.some(line => line.system === 'roof' && line.kind === kind)), 'a system groups by kind, in the kinds\' order')
  assert.ok(roof.groups.every(group => group.lines.length > 0 && group.lines.every(line => line.system === 'roof' && line.kind === group.id)))

  const protection = railGroups(lines, { type: 'kind', kind: 'protection' }, savingNow)
  assert.ok(protection.header.startsWith('Protection across the home · '), protection.header)
  assert.deepEqual(protection.groups.map(group => group.id), HOME_SYSTEMS.map(({ id }) => id).filter(id => lines.some(line => line.system === id && line.kind === 'protection')), 'a kind groups by system, in the systems\' order')

  const dot = railGroups(lines, { type: 'dot', system: 'roof', kind: 'protection' }, savingNow)
  assert.equal(dot.header, 'Roof & gutters · Protection · 1 benefit')
  assert.equal(dot.groups.length, 1, 'a dot is one group')

  const savingsKind = railGroups(lines, { type: 'kind', kind: 'savings' }, savingNow)
  const summed = lines.filter(line => line.kind === 'savings').reduce((total, line) => total + (line.figure ?? 0), 0)
  assert.ok(savingNow > 0 && summed !== savingNow, `the fixture's system lines (${summed}) overstate the build's saving (${savingNow})`)
  assert.deepEqual(savingsKind.groups.map(group => group.id), ['roof', 'attic'], 'the Savings kind groups by system, in the systems\' order')
  assert.ok(savingsKind.header.endsWith(` · ${formatAsDollars(savingNow)}/mo in savings`), `the Savings header reads the build's saving now: ${savingsKind.header}`)
  assert.equal(savingsKind.savings, `${formatAsDollars(savingNow)}/mo in savings`, 'the rail prints its saving as the readout does')
}

// ── Escape steps back through Benefits' layers ──────────────────────────────────
{
  const open: BenefitsState = { selection: { type: 'dot', system: 'roof', kind: 'protection' }, lookAhead: 7, costsOpen: true, whyOpen: true }
  const noWhy = benefitsStepBack(open)
  assert.deepEqual(noWhy, { ...open, whyOpen: false })
  const noCosts = benefitsStepBack(noWhy!)
  assert.deepEqual(noCosts, { ...open, whyOpen: false, costsOpen: false })
  const noSelection = benefitsStepBack(noCosts!)
  assert.deepEqual(noSelection, { selection: null, lookAhead: 7, costsOpen: false, whyOpen: false })
  assert.equal(benefitsStepBack(noSelection!), null, 'nothing left to close')
}

// ── Attic insulation offers follow what is there ───────────────────────────────
{
  const TOP_OFF = SCOPE_IDS.atticInsulationTopOff
  const INSULATION_SCOPES: string[] = [ATTIC_REPLACEMENT, TOP_OFF]
  const atticHome = (insulationLevel: PropertyProfile['insulationLevel'], roofType: PropertyProfile['roofType'] = 'shingle', wear?: Wear) =>
    inputs({ property: profile({ yearBuilt: '1950-1978', roofType, insulationLevel }), homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: wear ? { 'attic-insulation': wear } : {} } })
  const factsOf = (state: TradeSceneInputs) => ({ property: state.property, materials: state.homeMaterials, year: YEAR })
  const insulationRow = (state: TradeSceneInputs) => upgradeRows(factsOf(state), state.proposedScopeIds, state.efficiencyUpgrades).flatMap(system => system.rows).find(row => row.offer.partId === 'attic-insulation')!
  const pick = (state: TradeSceneInputs, scopeId: ScopeId | null) => applyAll(state, [{ kind: 'scope', offer: insulationRow(state).offer, scopeId }])
  const r38Of = (state: TradeSceneInputs) => slotsOf(state).find(slot => slot.id === 'upgrade:r38-insulation')!
  const battsOf = (state: TradeSceneInputs) => slotsOf(state).find(slot => slot.id === 'style:batts')!
  const insulationIn = (state: TradeSceneInputs) => roofAttic(resolveScene({ ...state, view: 'proposed' }, cuts)).parts.find(part => part.id === 'attic-insulation')!

  // What each level is offered, and whether R-38 comes with the pick.
  const table: [PropertyProfile['insulationLevel'], string[], Partial<Record<string, boolean>>][] = [
    ['none', [TOP_OFF], { [TOP_OFF]: false }],
    ['r11', [ATTIC_REPLACEMENT, TOP_OFF], { [ATTIC_REPLACEMENT]: false, [TOP_OFF]: false }],
    ['r19', [ATTIC_REPLACEMENT, TOP_OFF], { [ATTIC_REPLACEMENT]: false, [TOP_OFF]: false }],
    ['r30', [ATTIC_REPLACEMENT, TOP_OFF], { [ATTIC_REPLACEMENT]: false, [TOP_OFF]: true }],
    ['r38', [ATTIC_REPLACEMENT], { [ATTIC_REPLACEMENT]: true }],
  ]
  for (const [level, offered, required] of table) {
    const home = atticHome(level)
    assert.deepEqual([...insulationRow(home).scopeIds].sort(), [...offered].sort(), `${level}: offers ${offered.join(', ')}`)
    assert.equal(insulationRow(home).blocked, null)
    for (const scopeId of offered) {
      const picked = pick(home, scopeId as ScopeId)
      const slot = r38Of(picked)
      assert.equal(slot.required, required[scopeId], `${level} ${scopeId}: R-38 ${required[scopeId] ? 'comes with it' : 'is optional'}`)
      assert.equal(picked.efficiencyUpgrades.includes('r38-insulation'), required[scopeId], `${level} ${scopeId}: the required step is on`)
      assert.deepEqual(slot.options.map(option => option.value), required[scopeId] ? ['on'] : ['on', 'off'], `${level} ${scopeId}: a required step has no switch`)
      assert.equal(picked.view, 'existing', 'a pick never flips the scene to the build')
    }
  }
  const newR38 = insulationRow(atticHome('r38', 'shingle', 'new'))
  assert.deepEqual([newR38.scopeIds, newR38.blocked], [[], 'already-new'], 'R-38 at New is offered nothing')
  assert.equal(r38Of(atticHome('r19')).unavailable, 'Preview insulation to step up to R-38.', 'R-38 stays listed before insulation is picked')
  assert.ok(searchSceneChanges(slotsOf(pick(atticHome('r19'), TOP_OFF)), 'r-38').some(result => result.slot.id === 'upgrade:r38-insulation'), '"R-38" finds the step')
  assert.equal(EFFICIENCY_UPGRADE_LABELS['r38-insulation'], 'Step up to R-38')
  assert.equal(CONTROLS_COPY.systems.buildChips['attic-insulation'].short('Replace'), 'Replace', 'a replace chip names no R-value, which the R-38 step may change')

  // A flat roof's insulation is in its closed joists: offered only with a redeck in the build.
  const flat = atticHome('r11', 'flat')
  const deckOffer = upgradeRows(factsOf(flat), [], []).flatMap(system => system.rows).find(row => row.offer.partId === 'deck')!.offer
  const coverOffer = upgradeRows(factsOf(flat), [], []).flatMap(system => system.rows).find(row => row.offer.partId === 'covering')!.offer
  assert.deepEqual([insulationRow(flat).scopeIds, insulationRow(flat).blocked], [[], 'needs-redeck'], 'a flat roof with no picks: blocked on a redeck')
  const torched = applyAll(flat, [{ kind: 'scope', offer: coverOffer, scopeId: TORCH_DOWN }])
  assert.deepEqual([insulationRow(torched).scopeIds, insulationRow(torched).blocked], [[], 'needs-redeck'], 'torch down alone keeps the deck on, so still blocked')
  const redecked = applyAll(torched, [{ kind: 'scope', offer: deckOffer, scopeId: REDECK }])
  assert.deepEqual([[...insulationRow(redecked).scopeIds].sort(), insulationRow(redecked).blocked], [[...INSULATION_SCOPES].sort(), null], 'torch down and a redeck: offered')
  const flatTopped = pick(redecked, TOP_OFF)
  assert.ok(flatTopped.proposedScopeIds.includes(TOP_OFF))
  const undecked = applyAll(flatTopped, [{ kind: 'scope', offer: deckOffer, scopeId: null }])
  assert.deepEqual(undecked.proposedScopeIds, [TORCH_DOWN], 'the top off goes with the redeck, though torch down stays')
  assert.deepEqual(upgradeRowBlockedLine(insulationRow(flat), factsOf(flat), []), { included: false, text: 'Needs a redeck: the insulation is under the deck' })
  const flatAttic = upgradeRows(factsOf(flat), [], []).find(system => system.id === 'attic')!
  assert.deepEqual(flatAttic.rows.map(row => row.material), ['attic-insulation'], 'the Attic card keeps its existing insulation chip on a flat roof')
  assert.ok(slotsOf(flat).some(slot => slot.id === 'attic-insulation'))

  // Every control writes through applySceneChange, so the options a pick needs follow it.
  const r19 = atticHome('r19')
  const topped = pick(r19, TOP_OFF)
  assert.ok(!topped.efficiencyUpgrades.includes('r38-insulation'), 'a top off over R-19 starts at R-30')
  const raised = applyAll(topped, [{ kind: 'option', field: 'insulationLevel', value: 'r30' }])
  assert.ok(raised.proposedScopeIds.includes(TOP_OFF) && raised.efficiencyUpgrades.includes('r38-insulation'), 'raising the level to R-30 under a top off brings R-38 with it')
  assert.equal(insulationIn(raised).material, 'blown-r38')
  assert.deepEqual([insulationIn(raised).over, insulationIn(topped).over], ['batts-r30', 'batts-r19'])
  assert.ok(applyAll(raised, [{ kind: 'efficiency-upgrade', upgrade: 'r38-insulation', on: false }]).efficiencyUpgrades.includes('r38-insulation'), 'a required R-38 cannot be switched off')
  const overR38 = applyAll(raised, [{ kind: 'option', field: 'insulationLevel', value: 'r38' }])
  assert.ok(!overR38.proposedScopeIds.includes(TOP_OFF) && !overR38.efficiencyUpgrades.includes('r38-insulation'), 'raising the level to R-38 drops the top off, and its step')
  assert.ok(!pick(raised, null).efficiencyUpgrades.includes('r38-insulation'), 'removing the pick removes R-38')
  // A draw-only write keeps every array the resolver selects, so it never re-resolves the scene.
  const drawn = { ...topped, installStyles: [] }
  for (const change of [{ kind: 'fact', patch: { shingleColor: 'oyster-shell' } }, { kind: 'fact', patch: { paintWear: { stains: 'heavy' } } }] as const satisfies readonly SceneChange[]) {
    const patch = applySceneChange(drawn, change, YEAR)
    assert.ok(patch.proposedScopeIds === drawn.proposedScopeIds && patch.efficiencyUpgrades === drawn.efficiencyUpgrades && patch.installStyles === drawn.installStyles, `${Object.keys(change.patch)[0]}: the picks and their options keep their identity`)
    assert.ok(shallowEqual(selectResolveInputs(drawn), selectResolveInputs({ ...drawn, ...patch })), `${Object.keys(change.patch)[0]}: the resolver's inputs select equal`)
  }
  assert.notEqual(applySceneChange(topped, { kind: 'efficiency-upgrade', upgrade: 'r38-insulation', on: true }, YEAR).efficiencyUpgrades, topped.efficiencyUpgrades, 'a write that changes the options hands over a new array')
  const steppedUp = applyAll(topped, [{ kind: 'efficiency-upgrade', upgrade: 'r38-insulation', on: true }])
  assert.ok(steppedUp.efficiencyUpgrades.includes('r38-insulation') && !pick(steppedUp, null).efficiencyUpgrades.includes('r38-insulation'), 'an optional R-38 goes with its pick too')
  assert.deepEqual(pick(topped, ATTIC_REPLACEMENT).proposedScopeIds.filter(id => INSULATION_SCOPES.includes(id)), [ATTIC_REPLACEMENT], 'one insulation pick at a time')

  // Batts are a look on the replace only, at the same efficiency.
  assert.equal(battsOf(r19).unavailable, 'Preview an insulation replace to lay batts.', 'Batts stay listed before a replace is picked')
  assert.equal(battsOf(topped).unavailable, 'Preview an insulation replace to lay batts.', 'a top off is always blown in')
  const replaced = pick(r19, ATTIC_REPLACEMENT)
  assert.deepEqual([battsOf(replaced).unavailable, battsOf(replaced).current], [null, 'off'])
  const batts = applyAll(replaced, [battsOf(replaced).change('on')])
  assert.deepEqual(batts.installStyles, ['batts'])
  assert.equal(insulationIn(batts).material, 'batts-r30')
  assert.equal(insulationIn(applyAll(batts, [{ kind: 'efficiency-upgrade', upgrade: 'r38-insulation', on: true }])).material, 'batts-r38')
  assert.deepEqual(pick(batts, TOP_OFF).installStyles, [], 'switching to a top off drops batts')
  assert.deepEqual(pick(batts, null).installStyles, [], 'and so does removing the replace')
  assert.equal(battsOf(batts).name, 'Batts')
  assert.notEqual(sceneBurstKey(batts), sceneBurstKey(replaced), 'batts wake the scene')
  assert.deepEqual(selectResolveInputs(batts).installStyles, ['batts'], 'batts are a resolver input')
  assert.equal(HOME_SCENE_DEFAULTS.installStyles.length, 0)
  assert.deepEqual([INSULATION_DEPTH['blown-r30'], INSULATION_DEPTH['batts-r38']], [INSULATION_DEPTH['batts-r30'], INSULATION_DEPTH['blown-r38']], 'a style never changes the depth')
  assert.deepEqual([PART_HEAT_EFFECTS['attic-insulation']['blown-r30'], PART_HEAT_EFFECTS['attic-insulation']['batts-r38']], [PART_HEAT_EFFECTS['attic-insulation']['batts-r30'], PART_HEAT_EFFECTS['attic-insulation']['blown-r38']], 'nor the heat')

  // The benefit line names what goes in.
  const battsFacts = factsOf(batts)
  const battsScene = resolveScene({ ...batts, view: 'proposed', bills: BILLS }, cuts)
  const battsLines = buildBenefits({ facts: battsFacts, picks: pickedUpgrades(battsFacts, batts.proposedScopeIds, batts.efficiencyUpgrades), savings: battsScene.savings, repairs: repairsRows(batts.property, battsScene.home), efficiencyUpgrades: batts.efficiencyUpgrades, installStyles: batts.installStyles })
  assert.ok(battsLines.some(line => line.system === 'attic' && line.from === UPGRADE_REGISTRY[ATTIC_REPLACEMENT].name && /batts/.test(line.detail)), 'a batts replace\'s benefit line names batts')
}

// ── R-38 cuts 2 points more than R-30 ──────────────────────────────────────────
{
  const TOP_OFF = SCOPE_IDS.atticInsulationTopOff
  const R38: EfficiencyUpgradeId[] = ['r38-insulation']
  const atticProfile = (insulationLevel: PropertyProfile['insulationLevel']) => profile({ yearBuilt: '1950-1978', roofType: 'shingle', insulationLevel })
  const atticBuild = (insulationLevel: PropertyProfile['insulationLevel'], proposedScopeIds: string[], efficiencyUpgrades: EfficiencyUpgradeId[], installStyles: TradeSceneInputs['installStyles'] = []) =>
    resolveScene(inputs({ property: atticProfile(insulationLevel), view: 'proposed', proposedScopeIds, efficiencyUpgrades, installStyles, bills: BILLS }), cuts)
  // By hand from the table: the attic's base is 10 electric and 15 gas, and R-38's step up is 2 on each.
  const r30Cut = { electric: 0.10, gas: 0.15 }
  const r38Cut = { electric: 1 - 0.90 * 0.98, gas: 1 - 0.85 * 0.98 }
  const stepOnly = { electric: 0.02, gas: 0.02 }
  const none = { electric: 0, gas: 0 }
  const table: [string, PropertyProfile['insulationLevel'], string[], EfficiencyUpgradeId[], TradeSceneInputs['installStyles'], string, { electric: number, gas: number }][] = [
    ['R-19, top off to R-30', 'r19', [TOP_OFF], [], [], 'blown-r30', r30Cut],
    ['R-19, replace with R-30', 'r19', [ATTIC_REPLACEMENT], [], [], 'blown-r30', r30Cut],
    ['R-19, top off to R-38', 'r19', [TOP_OFF], R38, [], 'blown-r38', r38Cut],
    ['R-19, replace with R-38 batts', 'r19', [ATTIC_REPLACEMENT], R38, ['batts'], 'batts-r38', r38Cut],
    ['R-30, top off to R-38', 'r30', [TOP_OFF], R38, [], 'blown-r38', stepOnly],
    ['R-30, replace with R-30', 'r30', [ATTIC_REPLACEMENT], [], [], 'blown-r30', none],
    ['R-38, replace with R-38', 'r38', [ATTIC_REPLACEMENT], R38, [], 'blown-r38', none],
    ['none, top off to R-38', 'none', [TOP_OFF], R38, [], 'blown-r38', r38Cut],
  ]
  for (const [label, level, scopeIds, upgrades, styles, material, expected] of table) {
    const scene = atticBuild(level, scopeIds, upgrades, styles)
    assert.equal(roofAttic(scene).parts.find(part => part.id === 'attic-insulation')!.material, material, `${label}: installs ${material}`)
    for (const category of ['electric', 'gas'] as const) {
      near(scene.savings.cuts[category].combined, expected[category], 1e-12, `${label}: ${category} cut`)
    }
  }
  assert.deepEqual(atticBuild('r19', [TOP_OFF], R38).savings.cuts.electric.parts, [{ source: 'attic-and-basement', percent: 10 }, { source: 'insulation-step-up', percent: 2 }], 'below R-30: the base, then the step up')
  assert.deepEqual(atticBuild('r30', [TOP_OFF], R38).savings.cuts.gas.parts, [{ source: 'insulation-step-up', percent: 2 }], 'at R-30: the step up alone')

  // The radiant barrier and the attic fan still earn their add-on alone, and beside the step up.
  assert.deepEqual(atticBuild('r19', [RADIANT_BARRIER], []).savings.cuts.electric.parts, [{ source: 'radiant-barrier', percent: 5 }])
  assert.deepEqual(atticBuild('r19', [RADIANT_BARRIER], []).savings.cuts.gas.parts, [{ source: 'radiant-barrier', percent: 2 }])
  assert.deepEqual(atticBuild('r19', [SCOPE_IDS.atticFan], []).savings.cuts.electric.parts, [{ source: 'attic-fan', percent: 4 }])
  assert.deepEqual(atticBuild('r19', [SCOPE_IDS.atticFan], []).savings.cuts.gas.parts, [])
  const stepAndBarrier = atticBuild('r30', [TOP_OFF, RADIANT_BARRIER], R38).savings.cuts.electric
  assert.deepEqual(stepAndBarrier.parts.map(part => part.source).sort(), ['insulation-step-up', 'radiant-barrier'], 'R-30 topped off to R-38 beside a radiant barrier: two add-ons, no base')
  near(stepAndBarrier.combined, 1 - 0.98 * 0.95, 1e-12, 'they compound')

  // The step up's cut is the attic's, and the two futures read it.
  assert.equal(ADD_ON_SYSTEM['insulation-step-up'], 'attic')
  const r38Build = atticBuild('r19', [TOP_OFF], R38)
  near(systemCuts(r38Build.savings).attic!.electric!.percent, r38Cut.electric * 100, 1e-9, 'the attic\'s own cut carries the step up')
  const r38Repairs = repairsRows(atticProfile('r19'), r38Build.home)
  const today = todayCosts(r38Build.savings, r38Repairs, {})
  const after = afterCosts(r38Build.savings, r38Repairs, {})
  assert.deepEqual([today.electric, today.gas], [300, 120])
  assert.deepEqual([after.electric, after.gas], [Math.round(300 * (1 - r38Cut.electric)), Math.round(120 * (1 - r38Cut.gas))], 'an R-19 → R-38 build: the Tri Pros build side takes the step up')
  const r30Build = atticBuild('r19', [TOP_OFF], [])
  const r30Repairs = repairsRows(atticProfile('r19'), r30Build.home)
  const r30After = afterCosts(r30Build.savings, r30Repairs, {})
  assert.ok(futureYear(today, after, 10).saves > futureYear(todayCosts(r30Build.savings, r30Repairs, {}), r30After, 10).saves, 'R-38 saves more than R-30 in the two futures')
}

// ── Each system lists its system parts, and the spots that open it ─────────────
{
  const wholeParts = SYSTEM_PARTS.filter(entry => entry.id === entry.part)
  const homeAssemblies = ASSEMBLY_IDS.filter(id => id !== 'yard-ground')
  for (const assembly of homeAssemblies) {
    for (const { id } of ASSEMBLIES[assembly].parts) {
      const matches = wholeParts.filter(entry => entry.assembly === assembly && entry.part === id)
      assert.equal(matches.length, 1, `${assembly}/${id} is exactly one whole system part`)
      assert.equal(matches[0]!.systems.length, id === 'ceiling' ? 2 : 1, `${assembly}/${id}: only the ceiling is shared`)
    }
  }
  assert.ok(SYSTEM_PARTS.every(entry => homeAssemblies.includes(entry.assembly) && ASSEMBLIES[entry.assembly].parts.some(part => part.id === entry.part)), 'every system part sits on a construction part of the home, never the yard')
  assert.ok(SYSTEM_PARTS.every(entry => entry.id === entry.part || wholeParts.some(whole => whole.assembly === entry.assembly && whole.part === entry.part && whole.systems.join() === entry.systems.join())), 'a piece belongs to its whole part\'s system')
  assert.equal(new Set(SYSTEM_PARTS.map(entry => entry.id)).size, SYSTEM_PARTS.length, 'system part ids are unique')
  assert.deepEqual(SYSTEM_PARTS.find(entry => entry.id === 'ceiling'), { id: 'ceiling', assembly: 'roof-attic', part: 'ceiling', systems: ['roof', 'attic'], story: { roof: 'leak', attic: 'air-gaps' } })
  for (const { id, rows } of HOME_SYSTEMS) {
    for (const { assembly, part } of rows) {
      assert.ok(wholeParts.some(entry => entry.assembly === assembly && entry.part === part && (entry.systems as readonly HomeSystemId[]).includes(id)), `${id}'s row ${part} is a whole system part of ${id}`)
      assert.equal(systemOfPart(assembly, part), id, `${assembly}/${part} looks up to ${id}`)
    }
  }
  assert.equal(systemOfPart('roof-attic', 'ceiling'), null, 'a shared system part has no one system')
  assert.equal(systemOfPart('hvac-attic', 'condenser'), 'heating-cooling')
  assert.equal(systemOfPart('crawl-space', 'soil'), 'foundation')
  assert.deepEqual(Object.keys(SYSTEM_PART_LABELS).sort(), SYSTEM_PARTS.filter(entry => entry.id !== entry.part).map(entry => entry.id).sort(), 'every piece has a label, and only pieces')

  const everyHome = resolveHomeMaterials({ property: profile({ yearBuilt: '1950-1978', roofType: 'shingle', foundationType: 'raised', hvacType: 'central' }), materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR })
  assert.deepEqual(systemMaterialIds('heating-cooling', everyHome), ['heating-cooling', 'ducts'], 'a central home: the system and its ducts')
  assert.deepEqual(systemMaterialIds('roof', everyHome), ['roof'], 'gutters ride with the roof')
  const union = HOME_SYSTEMS.flatMap(({ id }) => systemMaterialIds(id, everyHome))
  assert.deepEqual([...union].sort(), [...HOME_MATERIAL_IDS].sort(), 'every material belongs to one system, once')
  const wallUnit = resolveHomeMaterials({ property: profile({ hvacType: 'wall-mounted', foundationType: 'slab' }), materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR })
  assert.deepEqual(systemMaterialIds('heating-cooling', wallUnit), ['heating-cooling'], 'a wall unit has no ducts')
  assert.deepEqual(systemMaterialIds('foundation', wallUnit), [], 'a slab has no crawl insulation')

  const partsByAssembly = (scene: ReturnType<typeof resolveScene>) => Object.fromEntries(Object.entries(scene.assemblies).map(([id, target]) => [id, target.parts]))

  const lowSlope = { form: 'low-slope', hvacType: 'central' } as const
  assert.deepEqual(systemsAtSpot('roof', { ...lowSlope, picks: [] }), ['roof'], 'a flat roof alone')
  assert.deepEqual(systemsAtSpot('roof', { ...lowSlope, picks: [TORCH_DOWN] }), ['roof'], 'a torch down keeps the deck on')
  assert.deepEqual(systemsAtSpot('roof', { ...lowSlope, picks: [TORCH_DOWN, REDECK] }), ['roof', 'attic'], 'a redeck opens the joists')
  assert.deepEqual(systemsAtSpot('roof', { form: 'pitched', picks: [], hvacType: null }), ['roof', 'attic'], 'a pitched roof opens the attic')
  assert.deepEqual(systemsAtSpot('window', { form: 'pitched', picks: [], hvacType: null }), ['windows'])
  assert.deepEqual(systemsAtSpot('equipment', { form: 'pitched', picks: [], hvacType: 'package-unit' }), ['heating-cooling'])
  assert.deepEqual(systemsAtSpot('equipment', { form: 'pitched', picks: [], hvacType: 'portable' }), [], 'a portable unit has no equipment spot')
  assert.equal(canLookInside('heating-cooling', { form: 'pitched', picks: [], hvacType: 'wall-mounted' }), false, 'a wall unit has nothing to look inside')
  assert.equal(canLookInside('heating-cooling', { form: 'pitched', picks: [], hvacType: null }), true)
  assert.equal(canLookInside('walls', { form: 'pitched', picks: [], hvacType: null }), false, 'walls wait for a later round')
  assert.equal(canLookInside('attic', { ...lowSlope, picks: [TORCH_DOWN] }), false, 'a flat roof\'s attic opens only with a redeck')
  assert.equal(canLookInside('attic', { ...lowSlope, picks: [TORCH_DOWN, REDECK] }), true)
  assert.deepEqual(LOOK_INSIDE_SYSTEM_IDS.map(id => SPOT_OF[id]), ['roof', 'roof', 'window', 'equipment'])

  // A part two systems share shows in each only for the story it tells there.
  const shownIds = (system: HomeSystemId, scene: ReturnType<typeof resolveScene>) => systemPartsShown(system, partsByAssembly(scene), systemStory(scene)).map(entry => entry.id)
  const rainFailing = at({ property: profile({ roofType: 'shingle' }), weather: 'rain', view: 'existing' })
  const normalFailing = at({ property: profile({ roofType: 'shingle' }), weather: 'normal', view: 'existing' })
  assert.ok(rainFailing.leak.reachesInside > 0, 'the fixture leaks')
  assert.ok(shownIds('roof', rainFailing).includes('ceiling'), 'a leak that reaches inside lights the ceiling in the roof')
  assert.ok(!shownIds('roof', normalFailing).includes('ceiling'), 'no leak, no ceiling in the roof')
  assert.ok(shownIds('attic', rainFailing).includes('ceiling'), 'open gaps light the ceiling in the attic')
  const sealed = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.airSealing], bills: BILLS })
  assert.ok(!shownIds('attic', sealed).includes('ceiling'), 'air sealing in the build closes the gaps')
  assert.deepEqual([systemStory(rainFailing).leak, systemStory(rainFailing).airGaps, systemStory(sealed).airGaps], [true, true, false])
  const flat = at({ property: profile({ roofType: 'flat' }), view: 'existing' })
  const flatShown = [...shownIds('roof', flat), ...shownIds('attic', flat)]
  for (const id of ['radiant-barrier', 'air-sealing', 'attic-fan'] as const) assert.ok(!flatShown.includes(id), `a flat roof shows no ${id}`)
  const singleShown = shownIds('windows', at({ property: sixtiesSingle }))
  assert.ok(singleShown.includes('pane') && !singleShown.includes('outer-pane'), 'a single-pane home\'s windows show pane, not outer-pane')

  const glazingOf = (patch: Partial<TradeSceneInputs>) => at(patch).assemblies.windows!.parts.find(part => part.id === 'glazing')!
  const installedDouble = glazingOf({ property: sixtiesSingle, view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement], bills: BILLS })
  const wornDouble = glazingOf({ property: { ...sixtiesSingle, windowsType: 'double' }, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'worn' } } })
  assert.deepEqual([installedDouble.material, installedDouble.condition, wornDouble.material, wornDouble.condition], ['double-pane', 'installed', 'double-pane', 'worn'], 'the fixtures are what they say')
  const drawnFor = (id: string) => (SYSTEM_PARTS.find(entry => entry.id === id) as SystemPart).drawnFor!
  assert.equal(drawnFor('low-e')(installedDouble), true, 'a new double-pane has its Low-E coating')
  assert.equal(drawnFor('low-e')(wornDouble), false, 'a worn double-pane draws none')
  assert.equal(drawnFor('argon')(installedDouble), true)
  assert.equal(drawnFor('argon')(wornDouble), false)
  assert.equal(drawnFor('air-gap')(installedDouble), false, 'argon fills a new window\'s gap')
  assert.equal(drawnFor('air-gap')(wornDouble), true, 'an old double-pane has a plain air gap')

  // Captured before the rename: Modify's build slots keep their ids.
  const BUILD_SLOT_IDS = ['build:covering', 'build:deck', 'build:gutter', 'build:radiant-barrier', 'build:attic-insulation', 'build:air-sealing', 'build:attic-fan', 'build:glazing', 'build:paint', 'build:air-handler', 'build:package-unit', 'build:duct-runs', 'build:floor-insulation']
  assert.deepEqual(HOME_SYSTEMS.flatMap(({ rows }) => rows.map(({ part }) => `build:${part}`)), BUILD_SLOT_IDS, 'the build slot ids are unchanged')
  assert.deepEqual(BUILD_ROW_PART_IDS.map(part => `build:${part}`), BUILD_SLOT_IDS)
}

// ── Up close fades the house by system, keeping that system's parts solid ──────
{
  const partsByAssembly = (scene: ReturnType<typeof resolveScene>) => Object.fromEntries(Object.entries(scene.assemblies).map(([id, target]) => [id, target.parts]))
  const dry = at({ property: profile({ roofType: 'shingle' }), weather: 'normal', view: 'existing' })
  const roofLit = (emphasized: SystemLit['emphasized'] = null): SystemLit => ({ system: 'roof', shown: new Set(systemPartsShown('roof', partsByAssembly(dry), systemStory(dry)).map(entry => entry.id)), emphasized })
  const ghost = LOOK_INSIDE.ghostOpacity
  assert.equal(ghost, HOME_GHOST_OPACITY, 'up close ghosts the house as the old close-up did')
  assert.ok(roofLit().shown.has('deck') && !roofLit().shown.has('ceiling'), 'the fixture: a dry roof shows its deck, not the ceiling')
  assert.equal(systemPartOpacity(systemPartTag('covering'), false, roofLit(), ghost), 1, 'a shown roof system part stays solid')
  assert.equal(systemPartOpacity(systemPartTag('attic-insulation'), false, roofLit(), ghost), ghost, 'an attic part under a lit roof takes the ghost')
  assert.equal(systemPartOpacity(systemPartTag('covering'), true, roofLit(), ghost), ghost, 'a roof part only the Complete house draws takes the ghost')
  assert.equal(systemPartOpacity(systemPartTag('ceiling'), false, roofLit(), ghost), ghost, 'a ceiling the roof does not show takes the ghost')
  assert.equal(systemPartOpacity({}, false, roofLit(), ghost), ghost, 'an untagged mesh takes the ghost')
  assert.equal(systemPartOpacity(systemPartTag('covering'), false, roofLit('deck'), ghost), LOOK_INSIDE.dimmedOpacity, 'another part\'s emphasis dims the covering')
  assert.equal(systemPartOpacity(systemPartTag('deck'), false, roofLit('deck'), ghost), 1, 'the emphasized deck stays whole')
  assert.equal(systemPartTag('deck'), systemPartTag('deck'), 'the tag is cached, so R3F never rewrites a group\'s userData')
  assert.deepEqual(Object.keys(systemPartTag('deck')), ['scenePart'], 'the one key carries no system name')

  // The house's tree: a thermal tag holding a nested system part tag, another tagged mesh and an untagged one, each kept
  // and only on the Complete house.
  const litMesh = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  const litScene = new Group()
  const litHouse = new Group()
  litHouse.userData = { ...thermalTag('exterior'), ...HOME_GHOST_TAG }
  const tagged = (userData: object, ...children: (Group | Mesh)[]) => {
    const group = new Group()
    group.userData = userData
    group.add(...children)
    return group
  }
  const deckMesh = litMesh()
  const coveringMesh = litMesh()
  const bareMesh = litMesh()
  const completeDeck = litMesh()
  const completeBare = litMesh()
  const soakedTwin = litMesh()
  litHouse.add(
    tagged(thermalTag(null, 'deck'), tagged(systemPartTag('deck'), deckMesh)),
    tagged(thermalTag(null, 'deck'), soakedTwin),
    tagged(systemPartTag('covering'), coveringMesh),
    bareMesh,
    tagged(HOME_FADE_TAGS.complete, tagged(thermalTag(null, 'deck'), tagged(systemPartTag('deck'), completeDeck)), completeBare),
  )
  litScene.add(litHouse)
  const litMeshes = [deckMesh, coveringMesh, bareMesh, completeDeck, completeBare, soakedTwin]
  applyGhost(litHouse, ghost, { ...HOME_FADES_SHOWN, complete: 0.4 }, undefined, roofLit())
  litMeshes.forEach((mesh, index) => near(mesh.material.opacity, [1, 1, ghost, ghost * 0.4, ghost * 0.4, ghost][index]!, 1e-9, `lit mesh ${index}`))
  assert.equal(deckMesh.material.transparent, false, 'a solid system part stays opaque')
  assert.equal(deckMesh.castShadow, deckMesh.userData.ghostCastShadow, 'and keeps its shadow')
  applyGhost(litHouse, ghost, { ...HOME_FADES_SHOWN, complete: 0.4 }, undefined, roofLit('deck'))
  near(coveringMesh.material.opacity, LOOK_INSIDE.dimmedOpacity, 1e-9, 'the deck\'s emphasis dims the covering in the house')
  near(deckMesh.material.opacity, 1, 1e-9, 'and the deck stays whole')
  applyGhost(deckMesh, ghost, HOME_FADES_SHOWN, undefined, roofLit())
  near(deckMesh.material.opacity, 1, 1e-9, 'a subtree woken later finds the system part tag above it')
  applyGhost(completeDeck, ghost, { ...HOME_FADES_SHOWN, complete: 0.4 }, undefined, roofLit())
  near(completeDeck.material.opacity, ghost * 0.4, 1e-9, 'and the Complete tag above it')
  applyGhost(litHouse, ghost, { ...HOME_FADES_SHOWN, complete: 0.4 })
  litMeshes.forEach((mesh, index) => near(mesh.material.opacity, [ghost, ghost, ghost, ghost * 0.4, ghost * 0.4, ghost][index]!, 1e-9, `without a lit system, mesh ${index} is today's ghost`))
  applyGhost(litHouse, ghost, { ...HOME_FADES_SHOWN, complete: 0.4 }, undefined, roofLit())
  applyGhost(litHouse, 1, HOME_FADES_SHOWN)
  for (const mesh of litMeshes) {
    const base = mesh.material.userData.ghostBase as { opacity: number, transparent: boolean, depthWrite: boolean }
    assert.deepEqual([mesh.material.opacity, mesh.material.transparent, mesh.material.depthWrite, mesh.visible], [base.opacity, base.transparent, base.depthWrite, true], 'leaving up close puts every material back')
  }
  // The thermal paint still reads the part through the nested tag: a soaked deck paints the same as its untagged twin.
  const litPaint = createThermalPaintSet(Object.fromEntries(HOME_PAINT_KEYS.map(key => [key, 0.5])) as Record<HomePaintKey, number>)
  paintThermal(litScene, litPaint, new Set(['deck']))
  assert.equal(deckMesh.material, soakedTwin.material, 'tagOf finds the thermal part above a system part tag')
  assert.notEqual(deckMesh.material, coveringMesh.material, 'and the soak reaches only the deck')
  restoreThermalPaint(litPaint)

  // Every whole system part the house draws carries a tag in the home kit.
  const kitDir = 'src/features/trade-scenes/ui/components/home-kit'
  const kitTagged = new Set(readdirSync(kitDir).flatMap(file => [...readFileSync(join(kitDir, file), 'utf8').matchAll(/systemPartTag\(([^)]*)\)/g)].flatMap(match => [...match[1]!.matchAll(/'([\w-]+)'/g)].map(id => id[1]!))))
  const UNTAGGED: Record<string, string> = {
    // Neither is drawn on the house yet.
    'ice-and-water': 'drawn with the stepped cutaway',
    'drip-edge': 'drawn with the stepped cutaway',
  }
  // Pieces are drawn on their whole part, and get their own tags with the stepped cutaway.
  const wholeOnHouse = SYSTEM_PARTS.filter(entry => entry.id === entry.part && entry.systems.some(system => (LOOK_INSIDE_SYSTEM_IDS as readonly HomeSystemId[]).includes(system)))
  for (const { id } of wholeOnHouse) {
    assert.equal(kitTagged.has(id), !(id in UNTAGGED), `${id}: ${UNTAGGED[id] ?? 'the house tags it'}`)
  }
  assert.ok([...kitTagged].every(id => wholeOnHouse.some(entry => entry.id === id)), `the house tags only whole system parts: ${[...kitTagged].join(', ')}`)
}

// Look inside: up close is a step into the system in focus, on the one house and the one card.
{
  // Escape steps back one layer a press, the innermost first; a window owns its own.
  const bare = { menu: false, lookInside: false, focus: null, open: null, pins: false } as const
  assert.equal(escapeStep({ ...bare, menu: true, lookInside: true, open: 'systems', focus: 'roof' }), 'menu', 'an open menu goes first')
  assert.equal(escapeStep({ ...bare, lookInside: true, open: 'systems', focus: 'roof' }), 'look-inside', 'up close goes before the system')
  assert.equal(escapeStep({ ...bare, open: 'systems', focus: 'roof' }), 'focus')
  assert.equal(escapeStep({ ...bare, open: 'systems' }), 'systems', 'Systems with no system in focus')
  assert.equal(escapeStep({ ...bare, open: 'systems', pins: true }), 'systems', 'pins count only with nothing open')
  assert.equal(escapeStep({ ...bare, pins: true }), 'pins', 'the pins at a spot, over the bare scene')
  assert.equal(escapeStep({ ...bare, open: 'modify', pins: true }), null, 'a window owns its Escape')
  assert.equal(escapeStep(bare), null, 'nothing to step back')

  // A tap on the house pins its systems where it was tapped, under ids no part or reading pin takes.
  for (const system of LOOK_INSIDE_SYSTEM_IDS) {
    assert.equal(spotFromPinId(spotPinId(system)), system, `${system}: its spot pin's id reads back`)
    assert.equal(spotFromPinId(partPinId(system)), null, `${system}: a part pin is no spot pin`)
  }
  assert.equal(spotFromPinId(readingPinId('roof')), null, 'a reading is no spot pin')
  assert.equal(spotFromPinId(spotPinId('walls')), null, 'no spot opens the walls')
  assert.ok(!spotPinId('roof').startsWith('part:') && !spotPinId('roof').startsWith('reading:'), 'the spot prefix is its own')
  for (const homeView of ['complete', 'partly-open'] as const) {
    const patch = pressHomeView(homeView)
    assert.notEqual(patch.homeView, homeView, `${homeView}: the home view turns`)
    assert.equal(patch.tappedSpot, null, `${homeView}: turning the home view lets the pins at a spot go`)
  }
  for (const form of ['pitched', 'low-slope'] as const) {
    assert.deepEqual(spotPinPoint('roof', form, null), HOME_ANCHORS[form].roof.position, `${form}: the roof's pin stands where its view looks`)
    assert.deepEqual(spotPinPoint('attic', form, null), HOME_ANCHORS[form].attic.position, `${form}: so does the attic's`)
    assert.deepEqual(spotPinPoint('windows', form, null), systemPartFocus('windows', form, 'glazing'), `${form}: the window's on the glass its view frames`)
    const [cx, cy, cz] = systemPartFocus('heating-cooling', form, 'condenser')!
    const [condenserX, condenserY, condenserZ] = spotPinPoint('heating-cooling', form, 'central')
    assert.ok(condenserX === cx && condenserZ === cz && condenserY > cy, `${form}: heating & cooling's stands over the condenser`)
    const [ux, uy, uz] = systemPartFocus('heating-cooling', form, 'package-unit')!
    const [unitX, unitY, unitZ] = spotPinPoint('heating-cooling', form, 'package-unit')
    assert.ok(unitX === ux && unitZ === uz && unitY > uy, `${form}: and over the package unit on a package home`)
  }
  // A house tap that answers itself claims the gesture, and the claim lasts until the next press.
  const claim = createTapClaim()
  assert.equal(claim.claimed(), false, 'a press starts unclaimed')
  claim.claimTap()
  assert.equal(claim.claimed(), true, 'a claim holds for the click that ends the tap')
  claim.release()
  assert.equal(claim.claimed(), false, 'the next press lets it go')
  // A pin over the canvas is a pick, like a rail chip: its tap is a tap on the scene too, so each claims it before it picks,
  // or the tap-away would close Systems (and leave Look inside) on the same click.
  for (const [file, pick] of [['src/features/trade-scenes/ui/components/panel/part-pins.tsx', 'emphasize(partId)'], ['src/features/trade-scenes/ui/components/spot-pin.tsx', 'pickFromPin(system)']] as const) {
    const code = readFileSync(file, 'utf8')
    assert.match(code, new RegExp(String.raw`claimTap\(\)\s*\n\s*${pick.replace(/[()]/g, String.raw`\$&`)}`), `${file}: the pin claims its tap before it picks`)
  }

  // A change that leaves nothing to look inside steps back to the system in the same write; the system keeps the camera.
  const stepsBack = (label: string, state: TradeSceneInputs, change: SceneChange) => {
    assert.deepEqual(keepLookInside(state), {}, `${label}: up close holds before the change`)
    const next = { ...state, ...applySceneChange(state, change, YEAR) }
    assert.deepEqual([next.lookInside, next.peel, next.emphasizedPart, next.cameraFocus], [false, 0, null, state.cameraFocus], `${label}: back to the system, still in focus`)
  }
  const flatHome = profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: 'r11', hvacType: 'central' })
  const flatRows = upgradeRows({ property: flatHome, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [TORCH_DOWN, REDECK], []).flatMap(system => system.rows)
  const deckOffer = flatRows.find(row => row.offer.partId === 'deck')!.offer
  const upClose = { lookInside: true, peel: 0.6 } as const
  stepsBack('a flat attic losing its redeck', inputs({ property: flatHome, view: 'proposed', proposedScopeIds: [TORCH_DOWN, REDECK], cameraFocus: 'attic', ...upClose, emphasizedPart: 'attic-insulation' }), { kind: 'scope', offer: deckOffer, scopeId: null })
  stepsBack('heating & cooling turning to a wall unit', inputs({ property: profile({ hvacType: 'central' }), cameraFocus: 'heating-cooling', ...upClose, emphasizedPart: 'duct-runs' }), { kind: 'property', patch: { hvacType: 'wall-mounted' } })
  stepsBack('a pitched attic turning flat', inputs({ property: profile({ roofType: 'shingle' }), cameraFocus: 'attic', ...upClose, emphasizedPart: null }), { kind: 'roof-form', form: 'low-slope' })
  const roofUpClose = inputs({ property: profile({ roofType: 'shingle' }), cameraFocus: 'roof', ...upClose, emphasizedPart: 'covering' })
  assert.deepEqual(applySceneChange(roofUpClose, { kind: 'roof-form', form: 'low-slope' }, YEAR).lookInside, undefined, 'a flat roof still opens its roof, so the change leaves up close alone')
  assert.deepEqual(keepLookInside({ ...roofUpClose, lookInside: false, property: profile({ hvacType: 'wall-mounted' }), cameraFocus: 'heating-cooling' }), {}, 'off up close nothing is asked')
  assert.deepEqual(LEAVE_LOOK_INSIDE, { lookInside: false, peel: 0, emphasizedPart: null })
  assert.equal(HOME_SCENE_DEFAULTS.lookInside, false, 'the scene opens on the whole home')

  // Up close aims where the system's view does and comes nearer. The roof, the windows and the package unit come straight in
  // along that view's bearing; the attic and the condenser's pad turn to keep what they look at in sight.
  // The near slope's covered face over a point, and whether a point lies within the slope's reach; a gable roof's only.
  const nearSlopeY = (z: number) => RAFTER_ORIGIN_Y + (HOUSE.halfDepth - z) * Math.tan(HOUSE.pitch) + COVERING_BASE / Math.cos(HOUSE.pitch)
  const overNearSlope = (point: readonly number[]) => {
    const along = (HOUSE.halfDepth - point[2]) / Math.cos(HOUSE.pitch)
    return Math.abs(point[0]) <= ROOF_HALF_LENGTH && along >= -EAVE_RUN && along <= SLOPE_LENGTH
  }
  // Where the sight line first passes through the near slope's covering, in metres from the camera, walked in centimetre steps;
  // null if it never does before the target.
  const slopeCrossing = (framing: CameraFraming) => {
    const length = Math.hypot(...framing.position.map((value, axis) => value - framing.target[axis]))
    const steps = Math.ceil(length * 100)
    const at = (step: number) => framing.position.map((value, axis) => value + (framing.target[axis] - value) * step / steps)
    for (let step = 1; step < steps; step++) {
      const [was, is] = [at(step - 1), at(step)]
      if (overNearSlope(is) && overNearSlope(was) && (was[1] - nearSlopeY(was[2])) * (is[1] - nearSlopeY(is[2])) <= 0) {
        return length * step / steps
      }
    }
    return null
  }
  let underRoof = 0
  for (const form of ROOF_FORMS) {
    for (const system of LOOK_INSIDE_SYSTEM_IDS) {
      for (const type of ['central', 'package-unit'] as const) {
        for (const shape of ['landscape', 'narrow', 'portrait'] as const) {
          for (const lift of [homeLift('slab'), homeLift('raised')]) {
            const hvac = { type, scale: 1 }
            const view = SYSTEM_CAMERA_VIEWS[system](form, shape, lift, hvac)
            const inside = lookInsideView(system, form, shape, lift, hvac)
            const label = `${form} ${system} ${type} ${shape} lift ${lift.toFixed(2)}`
            const away = (framing: CameraFraming) => framing.position.map((value, axis) => value - framing.target[axis])
            const [a, b] = [away(view), away(inside)]
            const [la, lb] = [Math.hypot(...a), Math.hypot(...b)]
            assert.deepEqual(inside.target, view.target, `${label}: up close aims where the system's view does`)
            assert.ok(lb < la * 0.9, `${label}: up close comes nearer (${lb.toFixed(2)} against ${la.toFixed(2)})`)
            assert.ok(lb >= HOME_ORBIT.minDistance, `${label}: up close stands within the orbit's reach (${lb.toFixed(2)} m)`)
            const pad = system === 'heating-cooling' && type === 'central'
            if (system !== 'attic' && !pad) {
              a.forEach((value, axis) => near(b[axis] / lb, value / la, 1e-9, `${label}: along the same bearing, axis ${axis}`))
            }
            // A target under the near slope is seen past the shingles, not through them.
            const target = inside.target
            if (form === 'pitched' && overNearSlope(target) && target[1] - lift < nearSlopeY(target[2])) {
              underRoof += 1
              const crossing = slopeCrossing({ ...inside, position: [inside.position[0], inside.position[1] - lift, inside.position[2]], target: [target[0], target[1] - lift, target[2]] })
              assert.equal(crossing, null, `${label}: the sight line crosses the near slope ${crossing?.toFixed(2)} m out, before the target`)
            }
            if (form === 'pitched' && system === 'attic') {
              const [x, y, z] = [inside.position[0], inside.position[1] - lift, inside.position[2]]
              const underRafters = nearSlopeY(z) - (COVERING_BASE + HOUSE.rafterDepth) / Math.cos(HOUSE.pitch)
              assert.ok(Math.abs(x) < HOUSE.halfLength - HOUSE.wallThickness && z < HOUSE.halfDepth && y < underRafters && y > WALL_TOP_Y + DEEPEST_INSULATION, `${label}: up close stands inside the attic, over the insulation and under the rafters ([${[x, y, z].map(value => value.toFixed(2)).join(', ')}], rafters at ${underRafters.toFixed(2)})`)
            }
            // The pad sits between the house and the lot's left wall: up close stands inside that wall, never behind it.
            if (pad) {
              assert.ok(inside.position[0] > LOT.left + LOT.wall.thickness, `${label}: up close stands inside the lot's left wall (x ${inside.position[0].toFixed(2)})`)
            }
          }
        }
      }
    }
  }
  assert.ok(underRoof >= 12, `the sight-line check reaches every view of a target under the near slope, the attic's among them (${underRoof})`)
  // The check is not vacuous: the attic seen straight in along its system's bearing, as before, crosses the near slope.
  const straightIn = SYSTEM_CAMERA_VIEWS.attic('pitched', 'landscape', 0, { type: null, scale: 1 })
  assert.ok(slopeCrossing({ ...straightIn, position: [0, 1, 2].map(axis => straightIn.target[axis] + (straightIn.position[axis] - straightIn.target[axis]) * 0.62) as [number, number, number] }) !== null, 'the attic straight in looks through the near slope')

  // Every system part shown up close has its own spot on the house for its pin and the camera's lean, apart from the others.
  const partsByAssembly = (scene: ReturnType<typeof resolveScene>) => Object.fromEntries(Object.entries(scene.assemblies).map(([id, target]) => [id, target.parts]))
  const roofHomes = [profile({ roofType: 'shingle', hvacType: 'central' }), profile({ roofType: 'flat', hvacType: 'package-unit' }), profile({ roofType: 'shingle', hvacType: 'package-unit', windowsType: 'double' })]
  for (const property of roofHomes) {
    for (const view of VIEWS) {
      for (const weather of ['normal', 'rain'] as const) {
        const scene = at({ property, view, weather, proposedScopeIds: view === 'proposed' ? FULL_BUILD : [], efficiencyUpgrades: view === 'proposed' ? FULL_BUILD_UPGRADES : [] })
        const form = homeRoofForm(roofAttic(scene).form)
        for (const system of LOOK_INSIDE_SYSTEM_IDS) {
          const rows = systemPartRows(system, scene)
          const label = `${property.roofType} ${property.hvacType} ${view} ${weather} ${system}`
          assert.deepEqual(rows.map(row => row.id), systemPartsShown(system, partsByAssembly(scene), systemStory(scene)).map(entry => entry.id), `${label}: the card lists what the house lights, in step order`)
          assert.ok(rows.every(row => row.label.length > 0 && row.condition !== 'absent'), `${label}: every row is named and there`)
          const points = rows.flatMap(row => row.id === 'drip-edge' || row.id === 'ice-and-water' ? [] : [systemPartFocus(system, form, row.id)])
          assert.ok(points.every(point => point !== null), `${label}: every drawn part has a spot`)
          const keys = points.map(point => point!.map(value => value.toFixed(3)).join(','))
          const shared = rows.filter(row => row.id === 'argon' || row.id === 'air-gap').length
          assert.equal(new Set(keys).size, keys.length - Math.max(0, shared - 1), `${label}: no two pins share a spot`)
        }
      }
    }
  }
  const glass = systemPartRows('windows', at({ property: profile({ windowsType: 'double' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement] }))
  assert.deepEqual(glass.find(row => row.id === 'argon')?.label, SYSTEM_PART_LABELS.argon, 'a piece reads its own label')
  assert.equal(glass.find(row => row.id === 'argon')?.condition, 'installed', 'on the condition of the part it is drawn on')
  assert.ok(systemPartFocus('roof', 'pitched', 'ceiling') !== systemPartFocus('attic', 'pitched', 'ceiling'), 'the ceiling is pointed at for its story in each system')

  // Nothing reads the retired close-up: no import of a deleted path, no zoom left in the feature's code, none of its names.
  const featureFiles = readdirSync('src/features/trade-scenes', { recursive: true, encoding: 'utf8' }).filter(file => /\.tsx?$/.test(file)).map(file => join('src/features/trade-scenes', file))
  const codeOf = (file: string) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const RETIRED_PATHS = /trade-scenes\/(?:ui\/components\/assembly-kits\/|constants\/(?:assembly-kits|assembly-kit-components|roof-attic-kit|roof-attic-flows|assembly-screens)'|contexts\/assembly-kit-fade-context'|lib\/(?:kit-framing|kit-heat-lanes|kit-line-spans|kit-paint-temperatures|roof-attic-kit-points|ribbon-paths|assembly-at-anchor)'|ui\/components\/panel\/(?:close-up-card|assembly-screen|assembly-screen-block|panel-header|parts-block)'|ui\/lib\/leave-close-up')/
  // This file names them to look for them.
  const scriptFiles = readdirSync('scripts').filter(file => /^verify-.*\.ts$/.test(file) && file !== 'verify-trade-scene.ts').map(file => join('scripts', file))
  for (const file of [...featureFiles, ...scriptFiles]) {
    const code = codeOf(file)
    assert.ok(!RETIRED_PATHS.test(code), `${file}: imports a retired close-up path`)
    assert.ok(!/\b(?:ASSEMBLY_KITS|LEAVE_CLOSE_UP|CloseUpCard)\b/.test(code), `${file}: names the retired close-up`)
  }
  for (const file of featureFiles) {
    assert.ok(!/zoom/i.test(codeOf(file)), `${file}: no zoom left in code, in any case or compound`)
  }
  // One covering, drawn by the house: the close-up drew its own, which drifted from the home's colour and wear.
  const coveringSites = featureFiles.filter(file => /<RoofCovering\b/.test(codeOf(file)))
  assert.deepEqual(coveringSites, ['src/features/trade-scenes/ui/components/home-kit/roof-slope.tsx'], 'the roof covering is mounted in one place, on the house\'s slope')
  assert.ok(existsSync('src/features/trade-scenes/ui/components/home-kit/roof-covering.tsx'), 'and drawn by one component')
}

console.log('verify-trade-scene: ok')
