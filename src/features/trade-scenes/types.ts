import type { FACTS_TABS } from '@/features/trade-scenes/constants/facts-tabs'
import type { FENCE_KIND_IDS } from '@/features/trade-scenes/constants/fence-kinds'
import type { GROUND_MATERIAL_IDS } from '@/features/trade-scenes/constants/ground-materials'
import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { HOME_FADES } from '@/features/trade-scenes/constants/home-fades'
import type { BUILD_ROW_PART_IDS, HOME_SPOT_IDS, HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import type { LookDevView, MaterialTreatment } from '@/features/trade-scenes/constants/look-dev-options'
import type { FULLY_OPEN_SYSTEM_IDS, PULLED_APART_SYSTEM_IDS, STEP_DEPTHS } from '@/features/trade-scenes/constants/look-inside'
import type { PLANT_SPECIES } from '@/features/trade-scenes/constants/lot-plants'
import type { TEXTURE_SET_IDS } from '@/features/trade-scenes/constants/material-textures'
import type { HOME_VIEWS } from '@/features/trade-scenes/constants/scene-controls'
import type { DOCK_FOLDS } from '@/features/trade-scenes/constants/scene-dock'
import type { SCENE_LOAD_PHASES } from '@/features/trade-scenes/constants/scene-load'
import type { PANE_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import type { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import type { AREA_GROUP_IDS, GROUND_SYSTEM_IDS, YARD_IDS, YARD_SYSTEM_IDS } from '@/features/trade-scenes/constants/yards'
import type { OfferBlockedReason, PartOffer } from '@/features/trade-scenes/lib/part-offers'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { RibbonStyle } from '@/shared/components/scene/constants/ribbon-styles'
import type { ThermalSeason, ThermalStyle } from '@/shared/components/scene/constants/thermal-palettes'
import type { PieceLayout, SceneRenderer } from '@/shared/components/scene/types'
import type { CustomerAgeGroup, HouseholdType } from '@/shared/constants/enums/customers'
import type { Resolved } from '@/shared/lib/resolve-overridable'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { CoveringWearKind, FoundationType, HvacIndoorLocation, HVACType, PaintWearKind, PaintWearLevel, Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { Basis, BillCut, BillEntry, EnergyMode, HeatWeather, HomeMaterialFacts, OfferKind, PropertyProfile, ReplaceableField, ResolvedHomeMaterials, ResolvedPart, WaterFlow, Weather } from '@/shared/modules/construction/core/types'

export interface LookDevOptions {
  treatment: MaterialTreatment
  thermalStyle: ThermalStyle
  ribbonStyle: RibbonStyle
  renderer: SceneRenderer
  season: ThermalSeason
  view: LookDevView
  heat: boolean
  emphasized: string | null
}

export type SectionLayerTexture = 'grain' | 'grit' | 'fiber' | 'smooth'

export type TextureSetId = typeof TEXTURE_SET_IDS[number]

export type TextureMapChoice = 'own' | 'grey' | { blend: string }

export type WornStep = 'fair' | 'worn' | 'failing'

export interface SurfaceTexture {
  set: TextureSetId
  map: TextureMapChoice
  mapTint?: string
  loadWhen?: boolean
}

export interface SectionLayer {
  id: string
  label: string
  group: 'roof' | 'attic'
  thickness: number
  color: string
  texture: SectionLayerTexture
  /** [inner, outer] temperature per season and view, hand-set until relativeHeatFlow drives them. */
  temperature: Record<ThermalSeason, Record<LookDevView, readonly [number, number]>>
}

export interface HandSetFlow {
  points: readonly [number, number, number][]
  widths: Record<LookDevView, readonly number[]>
}

export type SavingsCategory = 'electric' | 'gas'

export type HomeView = typeof HOME_VIEWS[number]

export interface TradeSceneInputs {
  property: PropertyProfile
  household: { type: HouseholdType | null, ageGroup: CustomerAgeGroup | null }
  view: 'existing' | 'proposed'
  weather: Weather
  climate: Climate | null
  homeView: HomeView
  thermalCamera: boolean
  lookInside: boolean
  proposedScopeIds: string[]
  efficiencyUpgrades: EfficiencyUpgradeId[]
  installStyles: InstallStyleId[]
  homeMaterials: HomeMaterialFacts
  // What the camera frames; only Focus and Look inside write it.
  cameraFocus: HomeSystemId | null
  // The system whose action card is open; a pick never moves the camera.
  pickedSystem: HomeSystemId | null
  peel: number
  emphasizedPart: SystemPartId | null
  // Where the house was last tapped; its chip shows until a pick, a tap away, Escape or a home-view change.
  tappedSpot: TappedSpot | null
  bills: Record<SavingsCategory, BillEntry>
  repairsOverrides: Partial<Record<TradeSlug, number | null>>
  layout: PropertyLayout
}

// What resolveScene reads; the drawing-only inputs (peel, emphasis, a tapped spot, home view, thermal camera, look) change no target, so a write to
// them must not re-resolve the scene.
export type SceneResolveInputs = Pick<TradeSceneInputs, 'property' | 'household' | 'view' | 'weather' | 'climate' | 'proposedScopeIds' | 'efficiencyUpgrades' | 'installStyles' | 'bills' | 'repairsOverrides'> & {
  // The drawing-only facts only draw, so a write to any of them must not re-resolve.
  homeMaterials: Omit<HomeMaterialFacts, DrawingOnlyMaterialFact>
}

export type Comfort = 'strained' | 'fair' | 'comfortable'

export type ResidentAge = 'young' | 'middle' | 'senior'

// Which of the pack's two figures plays the resident; a single woman's home must not show a man.
export type ResidentFigure = 'man' | 'woman'

export interface ResidentSpec {
  id: string
  role: 'adult' | 'child'
  age: ResidentAge
  figure: ResidentFigure
}

// What the residents are doing: the comfort they feel, or under rain whether water is coming in.
export type ResidentMood = Comfort | 'leaking' | 'dry'

export type ResidentGesture = 'fan' | 'shiver' | 'look-up'

export type ResidentPose = 'seated' | 'standing'

export interface ResidentPlacement {
  /** Where the figure's feet stand; a seated figure sits back from here onto the seat behind. */
  position: readonly [number, number, number]
  rotationY: number
  pose: ResidentPose
}

export interface ResidentAct {
  gesture: ResidentGesture | null
  blanket: boolean
}

export interface GestureSwing {
  bone: string
  axis: 0 | 1 | 2
  degrees: number
  /** Whole cycles per clip, so the clip loops without a seam. */
  cycles: number
}

export interface GestureSpec {
  seconds: number
  /** Degrees on each bone's own axes, held for the whole gesture: the pose it rests in. */
  hold: Readonly<Record<string, readonly [number, number, number]>>
  swings: readonly GestureSwing[]
}

export interface AssemblyTargets {
  assemblyId: AssemblyId
  form: string | null
  basis: Basis
  parts: ResolvedPart[]
  mode: EnergyMode | null
  water: WaterFlow | null
}

export interface SceneSavings {
  cuts: Record<SavingsCategory, BillCut>
  repairsMonthly: number
  repairsByTrade: Partial<Record<TradeSlug, Resolved>>
}

export interface MonthlyCosts {
  electric: number
  gas: number
  repairs: number
  total: number
}

export interface FutureYear {
  year: number
  without: MonthlyCosts
  with: MonthlyCosts
  saves: number
}

export interface SceneTargets {
  assemblies: Partial<Record<AssemblyId, AssemblyTargets>>
  heat: HomeHeat | null
  comfort: Comfort | null
  /** 0..1 */
  equipmentLoad: number
  /** 0..1 */
  meterSpeed: number
  leak: { reachesInside: number, soakedPartIds: string[] }
  home: ResolvedHomeMaterials
  residents: ResidentSpec[]
  savings: SceneSavings
  // The build replaces the rotted fascia: a new length over each rotted end, and a whole board where the rot has run along
  // its bottom edge.
  fasciaReplaced: boolean
  // The home's gutter before the build, null where it has none: the stains its overflow left outlast a new gutter.
  existingGutterWear: Wear | null
}

// What the home kit reads from the scene inputs: a narrower slice than the whole inputs, so a peel drag never redraws the house.
export type HomeKitInputs = Pick<TradeSceneInputs, 'property' | 'weather' | 'homeMaterials' | 'homeView'> & { climate: Climate }

// What the heating & cooling on show can run: Today and Build each answer it from their own systems.
export interface HvacDuties {
  cools: boolean
  heats: boolean
}

// Heating & cooling as the side on show draws it. An idle system stands where it was and runs nothing.
export interface DrawnHvac {
  indoor: { location: HvacIndoorLocation, blower: PartState, furnace: PartState | null, coil: PartState | null } | null
  // Where the indoor unit stood before the build moved it, drawn empty.
  vacated: HvacIndoorLocation | null
  outdoor: (PartState & { kind: 'condenser' | 'heat-pump' }) | null
  lineSet: boolean
  packageUnit: PartState | null
  ducts: PartState | null
  registers: boolean
  wallUnit: { kind: 'wall-furnace' | 'wall-unit', idle: boolean } | null
  windowUnit: { idle: boolean } | null
  miniSplit: { heads: number, idle: boolean, wear: number } | null
  duties: HvacDuties
}

// Each kind's share of the Worn look, 1 at Moderate.
export type CoveringShares = Record<CoveringWearKind, number>

// A covering's area, laid in a slope's own frame: x runs eave to ridge, y is the roof normal, z runs along the ridge.
export interface CourseArea {
  seed: number
  wear: number
  xFrom: number
  xTo: number
  zFrom: number
  zTo: number
  base: number
  shares: CoveringShares
  // A reused covering is the old one put back, so its pieces keep their places but not their breakage.
  reused: boolean
}

export type CoveringCourseKind = 'shingle' | 'shake' | 'pan' | 'cap'

// `crack` and `broken` each place that tile's own crack or broken corner, in (0, 1]. A replacement is a tile put in where one was
// cracked or broken, so it takes a tint of its own.
export interface CoveringPiece extends PieceLayout {
  crack?: number
  broken?: number
  replacement?: true
}

export interface ShingleCourse {
  exposure: number
  length: number
  tab: number
  gap: number
  thickness: number
  /** 0..1 share a tab's width may vary by; laminated architectural shingles vary, three-tab ones do not. */
  tabJitter?: number
}

export interface TileCourse {
  exposure: number
  length: number
  radius: number
}

export interface ShakeCourse {
  exposure: number
  length: number
  minWidth: number
  maxWidth: number
  gap: number
  thickness: number
  /** Share of the worn shakes drawn split down the grain, and the crack each opens. */
  splitShare?: number
  splitGap?: number
}

export interface BoxSpec {
  size: readonly [number, number, number]
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
}

/** One point on a gutter run's centre line. Drop is down from `GUTTER_Y`, out is away from the house, roll is about the run, in radians. */
export interface GutterStation {
  x: number
  drop: number
  out: number
  roll: number
}

// Where along each wall's run the roof's water lands on it, as spans in the house frame; empty where nothing lands.
export interface GutterWetSpans {
  front: readonly (readonly [number, number])[]
  back: readonly (readonly [number, number])[]
}

export interface GutterRun {
  face: 'front' | 'back'
  stations: readonly GutterStation[]
  capStart: boolean
  capEnd: boolean
}

export interface WallOpening {
  /** Centre along the wall's run. */
  along: number
  width: number
  /** Above the floor. */
  sill: number
  head: number
}

export interface HouseWall {
  run: 'x' | 'z'
  /** The wall's centre line on the other horizontal axis. */
  line: number
  /** Which way the outside faces along that axis. */
  outward: 1 | -1
  from: number
  to: number
  openings: readonly WallOpening[]
}

export interface RoomSpan {
  from: number
  to: number
  paint: string
  floor: string
}

export interface FurniturePlacement {
  id: string
  url: string
  position: readonly [number, number, number]
  rotationY: number
  scale: number
  /** Hung from its top (a ceiling fan) rather than stood on its base. */
  hang?: boolean
  castShadow?: boolean
  /** Matte colours by the model's material name, so the pack's colours sit in the home's palette. */
  colors: Readonly<Record<string, string>>
  standIn: { size: readonly [number, number, number], color: string }
}

export interface WeatherSky {
  sky: { top: string, horizon: string }
  /** The sun follows a day of the year and a clock hour; the floor keeps a low sun from laying the light flat. */
  sun: { day: number, hour: number, minElevation: number, color: string, intensity: number }
  fill: { sky: string, ground: string, intensity: number }
  /** Light thrown back up off the yard, which keeps the undersides inside the attic from going black. */
  bounce: { color: string, intensity: number }
  /** A clear day lights reflections and fill from the sky image; a sunny photograph would light a night or an overcast wrongly. */
  environment: { color: string, intensity: number, image: boolean }
  fog: { near: number, far: number }
  ground: { color: string, roughness: number }
  /** Emissive strength of the window glass; zero by day. */
  windowGlow: number
  /** The warm lamps in the rooms; zero by day. */
  roomLight: number
}

export type HomeReadings = Record<ReadingId, number>

export interface HomeHeatFlows {
  roofSource: number
  roofPasses: readonly [number, number]
  /** The sun on the walls and the glass, or the rooms' heat at them in winter: no part changes it. */
  wall: number
  window: number
  /** The share of what the face does not turn back that gets through it. */
  wallPasses: number
  windowPasses: number
}

export interface HomeHeatBounce {
  covering: number
  barrier: number
  wall: number
  window: number
}

export interface HomeHeat {
  readings: HomeReadings
  flows: HomeHeatFlows
  bounce: HomeHeatBounce
  /** 0..1 */
  load: number
  /** Installed and the attic reads over the fan thermostat's setpoint before the fan's own effect, so a running fan can't switch itself off. */
  atticFanRunning: boolean
}

export type StartingHomeHeat = Omit<HomeHeat, 'bounce' | 'flows' | 'atticFanRunning'> & { flows: Omit<HomeHeatFlows, 'wallPasses' | 'windowPasses'> }

export interface HeatEffect {
  /** °F added. */
  readings?: Partial<HomeReadings>
  /** Multipliers; roofPasses multiplies element-wise. A part never changes the sun on a wall or a window. */
  flows?: Partial<Omit<HomeHeatFlows, 'wall' | 'window'>>
  /** Shares added. */
  bounce?: Partial<HomeHeatBounce>
  /** Multiplier. */
  load?: number
}

export type WeatherHeatEffects = Partial<Record<HeatWeather, HeatEffect>>

export interface HomeShell {
  parts: readonly ResolvedPart[]
  form: RoofForm
}

export interface HeatLaneFlows {
  /** In flow order from the heat's source: summer and normal sky → covering → attic → room, winter room → attic → covering → sky. */
  roof: readonly [number, number, number]
  /** What gets past the covering and on to the radiant barrier, before the barrier turns its share back. */
  pastCovering: number
  coveringBounce: number
  barrierBounce: number
  /** [source, through], in flow order from the heat's source as `roof` is: summer outside → in, winter room → out. */
  wall: readonly [number, number]
  wallBounce: number
  window: readonly [number, number]
  windowBounce: number
}

export type Vec3 = readonly [number, number, number]

// A point in a slope's own frame: x up the slope from the wall line's top edge, y out along the roof's normal.
export type SlopePoint = readonly [number, number]

export interface ArrowLane {
  points: readonly Vec3[]
  count: number
  /** Metres per second along the lane. */
  speed: number
  /** 0..1, the heat the lane carries: its arrows shrink and dull as it drops. */
  flow: number
}

export interface ArrowStation {
  position: Vec3
  /** Unit tangent of the lane where the arrow sits. */
  direction: Vec3
  /** 0..1: arrows fade in and out at the lane's ends instead of popping. */
  fade: number
}

// A lane's points in world metres, named as heat crosses them in summer.
export interface RoofHeatLane {
  sky: Vec3
  covering: Vec3
  atticFloor: Vec3
  room: Vec3
  coveringBounceTo: Vec3
  barrier: Vec3
  barrierBounceTo: Vec3
}

export interface WallHeatLane {
  outside: Vec3
  face: Vec3
  inside: Vec3
  bounceTo: Vec3
}

// The Complete house's heat stops at the face it strikes; nothing is drawn inside.
export type CompleteRoofLane = Pick<RoofHeatLane, 'sky' | 'covering' | 'coveringBounceTo'>

export interface CompleteWallLane {
  outside: Vec3
  face: Vec3
  bounceTo: Vec3
}

export type HomeFade = typeof HOME_FADES[number]

// How strongly each fade's parts draw, 0 (gone) to 1 (whole).
export type HomeFadeLevels = Readonly<Record<HomeFade, number>>

// One prop shape for every choice field, so a field's `HOME_PROFILE_CHOICES` entry spreads straight in. `value` and
// `options` carry UNKNOWN_CHOICE when the field offers "Not sure".
export interface ChoiceFieldProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (next: T) => void
}

export type StageShape = 'landscape' | 'narrow' | 'portrait'

// CSS px from each canvas edge to where the uncovered area starts.
export interface SceneVisibleArea {
  left: number
  right: number
  bottom: number
  top: number
}

// How far the dock folds to fit the room it is given, in the order it folds.
export type DockFold = typeof DOCK_FOLDS[number]

// What the store selects for the resolver: the home material facts spread flat so a shallow compare sees each one.
export type SceneResolveSelection = Omit<SceneResolveInputs, 'homeMaterials'> & Omit<HomeMaterialFacts, DrawingOnlyMaterialFact>

export type HomeSystemId = typeof HOME_SYSTEM_IDS[number]

export interface HomeSystemRow {
  part: BuildRowPartId
  offer: PartOffer
  existing: ResolvedPart
  material: HomeMaterialId | null
  scopeIds: ScopeId[]
  blocked: OfferBlockedReason | null
  // Only the scopes the row holds; a scope that builds more than one part is 'saves-energy' when any of its installs saves.
  kinds: Partial<Record<ScopeId, OfferKind>>
}

export interface HomeSystemRows {
  id: HomeSystemId
  rows: HomeSystemRow[]
}

export interface PaintLook {
  color: string
  trim: string
  // The tone of the sun's fade patches on the body.
  fade: string
  wear: number
  paintWear: PaintWear
}

// A hole through the ceiling into the attic: a register boot, a recessed light's can or a plumbing vent pipe, at its
// ceiling point [x, z].
export interface CeilingOpening {
  kind: 'boot' | 'can' | 'pipe'
  at: readonly [number, number]
  radius: number
}

// Where the attic's duct runs lie: in a flat roof's joist space, on the joists, or hung level from the rafters.
export type DuctLayout = 'low-slope' | 'floor' | 'hung'

export interface CylinderSpec {
  radiusTop: number
  radiusBottom: number
  height: number
  segments: number
  position: Vec3
  rotation?: Vec3
}

export interface LotBoxes {
  blockWalls: readonly BoxSpec[]
  wallCaps: readonly BoxSpec[]
  fenceBoards: readonly BoxSpec[]
  fenceRails: readonly BoxSpec[]
  concrete: readonly BoxSpec[]
  concreteJoints: readonly BoxSpec[]
  asphalt: readonly BoxSpec[]
  mulch: readonly BoxSpec[]
}

export interface GarageBoxes {
  body: readonly BoxSpec[]
  trim: readonly BoxSpec[]
  door: readonly BoxSpec[]
  doorMouldings: readonly BoxSpec[]
  doorFields: readonly BoxSpec[]
  doorWindows: readonly BoxSpec[]
  doorLines: readonly BoxSpec[]
  membrane: readonly BoxSpec[]
  slopes: readonly BoxSpec[]
  fascia: readonly BoxSpec[]
}

export interface SunShadowFrustum {
  position: Vec3
  target: Vec3
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
}

// A neighbour's home, every one single-story: its footprint's centre [x, z] and size [x, z], and which way along z its
// front faces.
export interface NeighbourHouse {
  position: [number, number]
  size: [number, number]
  facing: 1 | -1
  stucco: string
  roof: string
  chimney?: boolean
}

export type PlantSpecies = typeof PLANT_SPECIES[number]

export type SceneLoadPhase = typeof SCENE_LOAD_PHASES[number]

export interface SceneLoadState {
  phase: SceneLoadPhase
  ready: boolean
}

export type PaintWear = Record<PaintWearKind, PaintWearLevel>
export type CoveringWear = Record<CoveringWearKind, PaintWearLevel>

// Every write a control makes, so one function applies them all and the picks a write can no longer take go in the same write.
export type SceneChange
  = | { kind: 'property', patch: Partial<PropertyProfile> }
    | { kind: 'roof-form', form: RoofForm | null }
    | { kind: 'wear', id: HomeMaterialId, wear: Wear }
    | { kind: 'option', field: ReplaceableField, value: string | null }
    | { kind: 'era-guess', id: HomeMaterialId }
    | { kind: 'era-code' }
    | { kind: 'fact', patch: Partial<Pick<HomeMaterialFacts, 'gutters' | 'gutterWear' | 'airSealing' | DrawingOnlyMaterialFact>> }
    | { kind: 'scope', offer: PartOffer, scopeId: ScopeId | null }
    | { kind: 'efficiency-upgrade', upgrade: EfficiencyUpgradeId, on: boolean }
    | { kind: 'install-style', style: InstallStyleId, on: boolean }
    | { kind: 'household', patch: Partial<TradeSceneInputs['household']> }
    | { kind: 'climate', climate: Climate }
    | { kind: 'bill', category: SavingsCategory, now: number | null }
    | { kind: 'repairs', trade: TradeSlug, perYear: number | null }
    | { kind: 'fascia-replacement', on: boolean }

export type SlotGroup = 'facts' | 'area' | 'systems' | 'existing' | 'proposed' | 'bills'

export type HomeFactId = 'foundation' | 'roof-form' | 'household' | 'age-group' | 'climate'

export type FactsTab = typeof FACTS_TABS[number]

export interface SceneChangeSlot {
  id: SceneChangeSlotId
  group: SlotGroup
  name: string
  words: string
  options: readonly { value: string, label: string }[]
  current: string | null
  isFact: boolean
  // A fact the rep may not know; a home always has a roof form and sits coastal or inland.
  offersNotSure: boolean
  // Set only on the two bill slots, which hold a money field instead of options.
  bill: SavingsCategory | null
  // Set only on an add-on no pick can take yet: why, said in place of its options, so a search for it still finds it.
  unavailable: string | null
  // An upgrade a pick cannot go without: listed as included, with no switch.
  required: boolean
  change: (value: string) => SceneChange
}

export interface UpgradeRowState {
  picked: ScopeId | null
  holdsCoolRoof: boolean
  holdsR8: boolean
  holdsCoolPaint: boolean
  holdsR38: boolean
  // The row's replace can be laid as batts.
  holdsBatts: boolean
  // A picked covering has a cool version, so the cool roof can be switched on.
  coolRoofOffered: boolean
  coolRoofOn: boolean
  // The pick is the truth: a Cool Life home holds the upgraded scope while the switch is off.
  coolPaintOn: boolean
  r8On: boolean
}

// A blocked row says why, or names the base its covering already brings.
export type UpgradeRowBlockedLine = { included: false, text: string } | { included: true, text: string | null }

// One colour's boxes among the marks a painted surface merges into a single draw.
export interface TintedBoxes {
  boxes: readonly BoxSpec[]
  color: string
}

export type ControlsSection = 'facts' | 'systems' | 'modify' | 'benefits'

// A picked system is the store's pickedSystem; Year built is a card with no system, held in the controls.
export type SystemsPick = HomeSystemId | 'year-built' | null

export type SystemActionId = 'focus' | 'look-inside' | 'draw-region' | 'draw-fence'

// Which of the stain atlas's soft shapes a stain draws: the band at a wall's foot, a runoff streak, or a fade blotch.
export type StainCell = 'splash' | 'streak' | 'blotch'

// One kind of stain among the see-through ones a painted surface merges into a single draw. Its strength rides in the vertex
// colour, since the view fades own the material's opacity.
export interface StainBoxes {
  cell: StainCell
  boxes: readonly StainBox[]
  color: string
  alpha: number
}

// A stain may show only part of its atlas cell: a stain cut where the wall meets the gable or parapet above it is two boxes, each
// showing its own share of the one shape, so the eye reads one stain across the seam. `u` is the share along the run, as seen
// from outside, and `v` the share of the height; each defaults to the whole cell.
export interface StainBox extends BoxSpec {
  u?: readonly [number, number]
  v?: readonly [number, number]
}

// A painted surface that wears up past its wall's top: its top edge at each point along the run, and the vents in it. A vent
// hangs streaks as a window does but has no sill to gather dirt, and the stains read any opening above the floor as a window, so a
// vent is never one of the wall's openings.
export interface PaintedSurface {
  topEdge: (along: number) => number
  vents: readonly WallOpening[]
}

export interface SurfaceStains {
  streaks: StainBox[]
  blotches: StainBox[]
}

// Peeling on one painted surface: the bare patches where the paint has gone, lying flush a hair proud of the face, and the flakes
// still lifting off their rims, a little prouder and leaning out.
export interface PeelingBoxes {
  bare: BoxSpec[]
  lifted: BoxSpec[]
}

// A Modify search result: the slot, and the one value the query picked out of it, which Enter sets.
export interface SceneChangeResult {
  slot: SceneChangeSlot
  hit: string | null
}

// The change Modify last applied, counted so its row's flash replays on each apply.
export type AppliedSceneChange = { id: string, count: number } | null

// A part a system action card's build row offers.
export type BuildRowPartId = typeof BUILD_ROW_PART_IDS[number]

export type SceneChangeSlotId
  = | 'household' | 'age-group' | 'foundation' | 'roof-form' | 'year-built' | 'climate'
    | HomeMaterialId | 'gutters' | 'gutter-wear' | 'air-sealing' | 'hvac-components' | 'ac-tons' | `wear:${HomeMaterialId}`
    | `build:${BuildRowPartId}` | `upgrade:${EfficiencyUpgradeId}` | `style:${InstallStyleId}` | `bill:${SavingsCategory}` | 'replace:fascia'

// What the Benefits window has picked: one dot, a whole system row, or a whole kind column.
export type BenefitSelection
  = | { type: 'dot', system: HomeSystemId, kind: BenefitKind }
    | { type: 'system', system: HomeSystemId }
    | { type: 'kind', kind: BenefitKind }

export interface BenefitsState {
  selection: BenefitSelection | null
  // The year the two futures are read at.
  lookAhead: number
  costsOpen: boolean
  whyOpen: boolean
}

// One statement in the Benefits window: written in the upgrade registry, or worked out from the picks and the savings.
export interface BenefitLine {
  system: HomeSystemId
  kind: BenefitKind
  title: string
  detail: string
  // The upgrade it is written for; null for a line worked out from the picks.
  from: string | null
  // Dollars a month.
  figure: number | null
  soon: boolean
}

// Where a tap on the house asks which systems are there.
export type HomeSpotId = typeof HOME_SPOT_IDS[number]

// A tap on the house: the point is in the space of the group the tapped part rides, since the lift moves the house with its
// foundation and the ground does not. The id grows by one a tap, so a second tap on one spot is a new tap.
export interface TappedSpot {
  id: number
  spot: HomeSpotId
  point: Vec3
  rides: 'lift' | 'ground'
  editing: HomeSystemId | null
}

// What a spot needs to know to say which systems it opens.
export interface HomeSpotContext {
  form: RoofForm
  picks: readonly string[]
  hvacType: HVACType | null
}

// What a shared system part is lit for in each of its systems.
export type SystemPartStory = 'leak' | 'sealing'

// A whole construction part (its id is the part's) or a piece drawn on one, which names and steps open but never moves a
// figure; membership is its own list because the part's group drives the heat math.
export interface SystemPart<Id extends string = SystemPartId> {
  id: Id
  assembly: AssemblyId
  part: string
  systems: readonly HomeSystemId[]
  story?: Partial<Record<HomeSystemId, SystemPartStory>>
  drawnFor?: (part: ResolvedPart) => boolean
  roofForms?: readonly RoofForm[]
  // Shown and lit, but the card and the pins leave it out: its pieces say what it is.
  listed?: false
}

export type SystemPartId = (typeof SYSTEM_PARTS)[number]['id']

type PieceIdOf<P> = P extends { id: infer Id, part: infer Part } ? (Id extends Part ? never : Id) : never
// The system parts that are pieces of a construction part rather than the whole of one.
export type SystemPieceId = PieceIdOf<(typeof SYSTEM_PARTS)[number]>

// What a group whose meshes draw one system part carries in its `userData`; untagged groups carry none.
export interface SystemPartTagData {
  scenePart?: SystemPartId
  // Lit with its part even where it stands on what only the Complete house draws: the framed window on the faded front wall.
  overFront?: true
}

// The system up close: the system parts it keeps solid, and the one a tap keeps whole while the rest of it dims.
export interface SystemLit {
  system: HomeSystemId
  shown: ReadonlySet<SystemPartId>
  emphasized: SystemPartId | null
}

export type RoofShape = 'gable' | 'hip' | 'flat'
export type MassRole = 'main' | 'wing' | 'garage'
export interface TileRect { c0: number, r0: number, cols: number, rows: number }
export interface Mass extends TileRect { id: string, stories: 1 | 2, ridgeAxis?: 'x' | 'z', role: MassRole }
export type LotSide = 'left' | 'right' | 'back' | 'front'
export interface LotGrade { padEndRow: number, walkDrop: number, streetDrop: number }
export type FenceAxis = 'across' | 'along'
// Each map is a tile grid of its own: across has rows + 1 lines of cols cells (line 0 the front lot line), along has
// cols + 1 lines of rows cells (line 0 the left lot line); a cell's index is line * cellsPerLine + cell on both.
export interface FenceMap { across: Uint8Array, along: Uint8Array }
export interface FenceLayers { existing: FenceMap, proposed: FenceMap }
// Cells along one grid line, `to` exclusive.
export interface LineRange { axis: FenceAxis, line: number, from: number, to: number }
// A corner of the grid, 0..cols by 0..rows inclusive: where fence lines cross, never a tile.
export type GridVertex = readonly [col: number, row: number]
// `appearance` packs a pattern and a colour of the material's own looks; a byte past its list reads as its first look.
export interface YardBase { material: GroundMaterialId, wear: Wear | null, appearance: number }
export interface LotLayout { cols: number, rows: number, existing: Uint8Array, proposed: Uint8Array, wear: Uint8Array, appearance: { existing: Uint8Array, proposed: Uint8Array }, bases: Record<YardId, YardBase>, fence: FenceLayers, grade: LotGrade }
export interface RoomStandIn { massId: string, kind: 'living' | 'kitchen' | 'bed' | 'bath', span: TileRect, story: 1 | 2 }
export interface HouseLayout { masses: readonly Mass[], roof: RoofShape, foundation: FoundationType, rooms: readonly RoomStandIn[] }
export interface DraftProvenance { address: string, imageryDate: string | null, sources: readonly string[], confidence: number }
export type LayoutSource = 'default' | 'drafted' | 'edited'
export interface PropertyLayout { version: 1, tile: number, lot: LotLayout, house: HouseLayout, source: LayoutSource, draft?: DraftProvenance }
export type GroundMaterialId = typeof GROUND_MATERIAL_IDS[number]
export type FenceKindId = typeof FENCE_KIND_IDS[number]
export type YardId = typeof YARD_IDS[number]
export type AreaGroupId = typeof AREA_GROUP_IDS[number]
export type GroundSystemId = typeof GROUND_SYSTEM_IDS[number]
export type YardSystemId = typeof YARD_SYSTEM_IDS[number]
// A stretch of cells on one grid line whose (existing, proposed) pair is equal: the regions' rule on cells.
export interface FenceLine extends LineRange { id: string, existing: FenceKindId | null, proposed: FenceKindId | null, perimeter: boolean, frontYard: boolean }
export type GroundLayer = TradeSceneInputs['view']
export interface LotRegion { id: string, existing: GroundMaterialId | null, proposed: GroundMaterialId | null, wear: Wear | null, appearanceExisting: number, appearanceProposed: number, yard: YardId, base: boolean, tiles: number, rings: readonly (readonly [number, number])[][], bbox: TileRect }
// Not "frame": that word is the presentation's. Tile (0, 0) is the street-side left corner; rows run away from the street.
export interface LotOrigin { originX: number, frontZ: number, tile: number }
export interface WorldRect { x0: number, x1: number, z0: number, z1: number }
export interface LotBounds { left: number, right: number, front: number, back: number }
// The stoop and the driveway apron ride in `concrete`; the driveway, the walk and the beds are regions.
export type LayoutLotBoxes = Pick<LotBoxes, 'concrete' | 'asphalt'>
// One list per look, so each mounts as one merged mesh and a lot without that kind draws nothing for it.
export interface FenceBoxes {
  blockWalls: readonly BoxSpec[]
  wallCaps: readonly BoxSpec[]
  fenceBoards: readonly BoxSpec[]
  fenceRails: readonly BoxSpec[]
  vinylParts: readonly BoxSpec[]
  compositeBoards: readonly BoxSpec[]
  compositePosts: readonly BoxSpec[]
  ironwork: readonly BoxSpec[]
  chainPosts: readonly BoxSpec[]
  chainMesh: readonly BoxSpec[]
}
export interface ResolvedLayout { layout: PropertyLayout, origin: LotOrigin, bounds: LotBounds, groundRows: readonly (readonly [number, number])[], heightAt: (z: number) => number, mask: Uint8Array, yards: Int8Array, regions: readonly LotRegion[], fenceMask: FenceMap, fences: readonly FenceLine[], main: WorldRect, garage: WorldRect | null, boxes: LayoutLotBoxes, fenceBoxes: Record<GroundLayer, FenceBoxes> }
// A shown system part as its system's list and its pins name it.
export type SystemPartRow = ResolvedPart & { id: SystemPartId, listed?: false }

// The systems whose flows cross the house up close.
export type CutawaySystemId = 'roof' | 'attic'

// How the cutaway stands: the system it opens, the parts it shows, and how far its steps are open.
export interface CutawaySteps {
  system: CutawaySystemId
  shown: ReadonlySet<SystemPartId>
  peel: number
}

// Where a flow crosses one system part up close, at the part's step: its outer face and its inner face, plus its outer face
// in the middle of the strip the step shows, where a flow from outside lands on it.
export interface CutawayCrossing {
  partId: SystemPartId
  outer: Vec3
  inner: Vec3
  tread: Vec3
}

// The rain's line through the cutaway and its share (0..1) at each point; `drip` when it gets past the ceiling.
export interface CutawayRainPath {
  points: [number, number, number][]
  widths: number[]
  drip: boolean
}

// A rotted area on a wood part's step: its turn about the house's x (the slope's pitch on a gable), and how thick it is drawn,
// right through a thin part so it shows from the attic too. `size` is its two sides, along the house and up the slope: a
// stain's span, or, where the build cut the old deck's rot out (`woodReplaced`), the fresh sheet set in its place.
export interface CutawayRotSpot {
  partId: SystemPartId
  position: Vec3
  tilt: number
  thickness: number
  size: readonly [number, number]
  woodReplaced?: true
}

// A part's temperatures on the fixed thermal scale, 0..1: its face toward the rooms and its face toward the sky.
export interface PartPaint {
  inner: number
  outer: number
}

// The home's readings a part's two faces take: the one toward the rooms and the one toward the sky.
export interface PartPaintFaces {
  inner: 'roof' | 'attic' | 'ceiling'
  outer: 'roof' | 'attic' | 'ceiling'
}

// The systems that step open up close: the ones with a step depth.
export type SteppedSystemId = keyof typeof STEP_DEPTHS

// The systems with a slider to drag up close: the stepped ones but those that stand fully open, and the ones that pull apart.
export type PeeledSystemId = Exclude<SteppedSystemId, (typeof FULLY_OPEN_SYSTEM_IDS)[number]> | (typeof PULLED_APART_SYSTEM_IDS)[number]

// The window's glazing pieces up close.
export type WindowPieceId = keyof typeof PANE_LOOKS

// The systems whose heat crosses one face of the house up close: the window through its parts, the wall whole.
export type CutawayFaceSystemId = 'windows' | 'walls'

// A face's heat as its legs, outside in as for summer: the yard's side up to the face, the room's side on from it (the
// Complete house draws none), and the heat the face turns back (none where nothing on it does).
export interface FaceLegPoints {
  outside: readonly Vec3[]
  inside: readonly Vec3[] | null
  bounce: readonly Vec3[] | null
}

/** A gutter the home draws: how worn it is, and its colour. */
export interface DrawnGutter {
  wear: Wear
  hex: string
}

// The home material facts that only draw: no scope, part, material or figure reads them, so a change never re-resolves the scene.
export type DrawingOnlyMaterialFact = 'acTons' | 'hvacIndoorLocation' | 'proposedHvacIndoorLocation' | 'miniSplitHeads' | 'proposedMiniSplitHeads' | 'shingleColor' | 'paintWear' | 'coveringWear' | 'existingPaintColors' | 'proposedPaintColors' | 'windowFrameColor' | 'existingGutterColor' | 'proposedGutterColor'

// The two hexes the house's paint draws: the body of the walls and the trim round them.
export interface PaintHexes {
  body: string
  trim: string
}

// One eave fascia's run, measured along its own board as `fasciaPeeling` measures it: the house's two eaves in their slope's
// frame, the garage's along x.
export interface FasciaRun {
  face: 'front' | 'back' | 'garage'
  from: number
  to: number
}

// Rot on a fascia: at a board end, the full board's height, or along a board's bottom edge (`bottom`).
export interface FasciaRotSpot {
  face: FasciaRun['face']
  along: readonly [number, number]
  bottom: boolean
}
