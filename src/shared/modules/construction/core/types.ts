import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { WrittenBenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { CutMode } from '@/shared/modules/construction/core/constants/cut-modes'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { AcTons, CrawlInsulation, DuctMaterial, ExteriorPaint, FoundationType, GutterOption, HVACComponent, HVACType, InsulationLevel, PaintWearKind, PaintWearLevel, RoofType, Wear, WindowsType } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { OwensCorningColorId } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

export type CutSource = TradeSlug | BillCutAddOnId

export interface CutPart<S extends string = CutSource> {
  source: S
  percent: number
}

export interface BillEntry {
  now: number | null
  cut: { mode: CutMode, value: number | null }
}

export interface BillCut<S extends string = CutSource> {
  bill: number
  parts: CutPart<S>[]
  combined: number
  after: number
  typed: boolean
}

// The property facts the construction model reads, every one possibly unknown in a meeting.
export interface PropertyProfile {
  yearBuilt: YearBuiltRange | null
  roofType: RoofType | null
  foundationType: FoundationType | null
  hvacType: HVACType | null
  insulationLevel: InsulationLevel | null
  windowsType: WindowsType | null
  hvacComponents: HVACComponent | null
}

export type Basis = 'recorded' | 'era-typical' | 'typical'
export type PartCondition = 'retained' | 'worn' | 'absent' | 'installed'
export type PartRole = 'structure' | 'shed-water' | 'reflect' | 'insulate' | 'seal' | 'ventilate' | 'surface' | 'irrigate' | 'equipment'
export type EnergyMode = 'thermal' | 'water'
export type Weather = 'normal' | 'summer' | 'winter' | 'rain'
export type HeatWeather = Exclude<Weather, 'rain'>
export type Season = 'summer' | 'winter'

export interface PartCopy {
  label: string
  detail: string
}

interface PartMaterialFields {
  copy: PartCopy
  conditionCopy?: Partial<Record<PartCondition, PartCopy>>
  // Forms this material can be built on; absent means any.
  forms?: readonly string[]
  thermal?: { rValue?: number, reflectance?: number, winterReflectance?: number }
  water?: { demand?: number, passThrough?: number }
  // Higher saves more energy; a material without one never saves.
  energyRank?: number
  // Installing this material also installs `with` on `part` when that part currently holds one of `replaces`.
  needsBase?: { part: string, replaces: readonly string[], with: string, copy: PartCopy }
}

// A saving install earns its trade's base cut, or `cut`, an add-on of its scope's trade, in its place. A step up earns both, each
// on its own: the base when `from` would save over what the home has, and the add-on when the material itself does.
export type PartMaterialDefinition = PartMaterialFields & (
  | { cut?: BillCutAddOnId, stepUp?: never }
  | { cut?: never, stepUp?: { from: string, cut: BillCutAddOnId } }
)

export interface PartDefinition {
  id: string
  group: string
  role: PartRole
  forms?: readonly string[]
  materials: Readonly<Record<string, PartMaterialDefinition>>
  absentCopy?: PartCopy
  // Collects shed water at the roof's edge instead of sitting in the rain path.
  edge?: true
}

export interface Assembly {
  id: AssemblyId
  trades: readonly TradeSlug[]
  modes: Partial<Record<Weather, EnergyMode>>
  // Parts in outerGroup lie between outside and the cavity air; the rest lie between the cavity and inside.
  readings?: { outerGroup: string }
  appliesTo?: (property: PropertyProfile) => boolean
  forms?: readonly string[]
  parts: readonly PartDefinition[]
}

export interface ExistingPart {
  material: string | null
  condition: PartCondition
  wear?: Wear
}

export interface ExistingConditions {
  form: string | null
  parts: Readonly<Record<string, ExistingPart>>
  basis: Basis
}

export interface ResolvedPart {
  id: string
  group: string
  role: PartRole
  edge?: true
  material: string | null
  condition: PartCondition
  wear?: Wear
  label: string
  detail: string
  thermal: { rValue?: number, reflectance?: number, winterReflectance?: number } | null
  water: { demand?: number, passThrough?: number } | null
  // What the installed material is laid over, when its install adds to the part instead of replacing it.
  over?: string
}

export interface ScopeInstall {
  assembly: AssemblyId
  // The catalog owns a scope's trade; it is copied here because the core cannot read the catalog, and the scope check holds the two equal.
  trade: TradeSlug
  installs: readonly {
    part: string
    material: string
    swapsWith?: Partial<Record<EfficiencyUpgradeId, string>>
    // Laid on top of what the part already holds, which stays under it.
    addsTo?: true
    // The material after the efficiency swap, mapped to its look in each style.
    styles?: Partial<Record<InstallStyleId, Readonly<Record<string, string>>>>
  }[]
}

export interface UpgradeBenefit {
  kind: WrittenBenefitKind
  title: string
  detail: string
  onlyWith?: EfficiencyUpgradeId
  onlyWithout?: EfficiencyUpgradeId
}

export interface UpgradeEntry {
  name: string
  benefits: readonly UpgradeBenefit[]
}

export interface FlowProfile {
  /** Relative flow at each part boundary from the source side, length = parts + 1; 1 = unobstructed. */
  boundaries: number[]
  /** 0..1 at each part's inner and outer face; for heat, the °F walk placed on the thermal scale. */
  parts: Record<string, { inner: number, outer: number }>
  /** Share of the incoming flow the source-side surface sends back (a cool roof's reflection in summer); 0 for water. */
  reflected: number
}

export interface WaterFlow extends FlowProfile {
  /** Share of the rain the roof sends off before it can soak anything. */
  shed: number
  /** Share of the rain each worn part soaks up, by part id. */
  soaked: Record<string, number>
  /** Share of the rain that gets past the innermost part. */
  reachesInside: number
}

/** °F estimates; cavityAir is null for an assembly with no air space between its parts. */
export interface ThermalReadings {
  outerSurface: number
  cavityAir: number | null
  innerSurface: number
}

export interface ThermalWalk {
  readings: ThermalReadings
  /** °F at each part's inner and outer face. */
  faces: Record<string, { inner: number, outer: number }>
}

/** The first year of each wear step after New. */
export type AgeBands = readonly [good: number, fair: number, worn: number, failing: number]

export type ReplaceableField = 'insulationLevel' | 'windowsType' | 'exteriorPaint' | 'ducts' | 'crawlInsulation'

export type OfferKind = 'saves-energy' | 'like-for-like'

export interface ShingleColor {
  id: string
  line: 'cool' | 'cool-plus'
  name: string
  hex: string
  agedSri: number
}

export interface HomeMaterialFacts {
  wear: Partial<Record<HomeMaterialId, Wear>>
  gutters: GutterOption | null
  exteriorPaint: ExteriorPaint | null
  ducts: DuctMaterial | null
  crawlInsulation: CrawlInsulation | null
  acTons: AcTons | null
  shingleColor: OwensCorningColorId | null
  paintWear: Partial<Record<PaintWearKind, PaintWearLevel>>
}

export interface HomeFacts {
  property: PropertyProfile
  materials: HomeMaterialFacts
  year: number
}

export interface HomeMaterialDefinition {
  trade: TradeSlug
  repairs: boolean
  parts: readonly { assembly: AssemblyId, part: string }[]
  // The part that is the material: a new gutter is not a new roof.
  repairsEndWith: readonly { assembly: AssemblyId, part: string }[]
  // Keyed 'all', or by roof type for the roof.
  bands: Readonly<Record<string, AgeBands>>
  replaceable: ReplaceableField | null
  eraGuess: Readonly<Record<YearBuiltRange, string>> | null
  // Absent: applies when every assembly its parts draw applies.
  appliesTo?: (property: PropertyProfile) => boolean
}

export interface ResolvedHomeMaterial {
  id: HomeMaterialId
  option: string | null
  optionBasis: Exclude<Basis, 'typical'> | null
  wear: Wear | null
  wearBasis: Exclude<Basis, 'typical'> | null
  eraWear: Wear | null
  absent: boolean
}

export type ResolvedHomeMaterials = Partial<Record<HomeMaterialId, ResolvedHomeMaterial>>

export interface BillYear<C extends string> {
  t: number
  billsNow: Record<C, number>
  billsAfter: Record<C, number>
}
