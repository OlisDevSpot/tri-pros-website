import type {
  AssemblyLayer,
  BuildState,
  CoveringKind,
  CutawayProfile,
  CutawayScope,
  RoofAssembly,
} from '@/features/meeting-visualizations/types'
import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { InsulationLevel, RoofType } from '@/shared/modules/construction/core/constants/enums'
import { LAYER_COPY } from '@/features/meeting-visualizations/constants/roof-cutaway-copy'

// The R-value we show for a Tri Pros attic is a placeholder: Title 24 alteration minimums differ by
// climate zone, and the field team has not yet confirmed the depth they blow in across the service area.
const TRI_PROS_ATTIC_R_VALUE = 38

const R_VALUE_BY_LEVEL: Record<InsulationLevel, number> = { low: 11, medium: 19, high: 30 }

// Installed depth per R-value, so the drawing's blanket height is honest relative to the joists.
const INCHES_BY_R_VALUE: Record<number, number> = { 11: 3.5, 19: 6.25, 30: 10, 38: 13 }

const ERA_FALLBACK: YearBuiltRange = '1950-1978'

const INSULATION_BY_ERA: Record<YearBuiltRange, InsulationLevel> = {
  'Pre-1950': 'low',
  '1950-1978': 'low',
  '1978-1998': 'medium',
  '1998-2014': 'medium',
  'Post-2014': 'high',
}

function coveringFor(roofType: RoofType | null): CoveringKind {
  return roofType === 'tile' ? 'tile' : 'shingle'
}

function layer(id: AssemblyLayer['id'], group: AssemblyLayer['group'], status: AssemblyLayer['status'], copy: { label: string, detail: string }): AssemblyLayer {
  return { id, group, status, label: copy.label, detail: copy.detail }
}

export function resolveRoofAssembly(profile: CutawayProfile, scope: CutawayScope, build: BuildState): RoofAssembly {
  const era = profile.yearBuilt ?? ERA_FALLBACK
  const isTypical = profile.roofType === null || profile.yearBuilt === null || profile.insulationLevel === null
  const covering = coveringFor(profile.roofType)

  const roofUpgraded = build === 'tri-pros' && scope.roof
  const atticUpgraded = build === 'tri-pros' && scope.attic

  const originalDeckIsBoards = era === 'Pre-1950' || profile.roofType === 'woodshake'
  const deck = roofUpgraded || !originalDeckIsBoards ? 'solid' : 'skip-sheathing'
  const hasDripEdge = roofUpgraded || era === '1978-1998' || era === '1998-2014' || era === 'Post-2014'
  const underlayment = roofUpgraded ? 'synthetic' : 'felt'

  const todayLevel = profile.insulationLevel ?? INSULATION_BY_ERA[era]
  const insulationRValue = atticUpgraded ? TRI_PROS_ATTIC_R_VALUE : R_VALUE_BY_LEVEL[todayLevel]

  const coveringKey = `${covering}-${roofUpgraded ? 'new' : 'worn'}` as const
  const deckCopy = deck === 'skip-sheathing' ? LAYER_COPY.deck['skip-sheathing'] : roofUpgraded ? LAYER_COPY.deck.new : LAYER_COPY.deck.aged
  const insulationCopy = atticUpgraded ? LAYER_COPY.insulation.new : LAYER_COPY.insulation.aged

  const layers: AssemblyLayer[] = [
    layer('rafters', 'roof', 'existing', LAYER_COPY.rafters.existing),
    layer('deck', 'roof', roofUpgraded ? 'new' : 'aged', deckCopy),
    layer('ice-water', 'roof', roofUpgraded ? 'new' : 'missing', roofUpgraded ? LAYER_COPY['ice-water'].new : LAYER_COPY['ice-water'].missing),
    layer('underlayment', 'roof', roofUpgraded ? 'new' : 'aged', LAYER_COPY.underlayment[underlayment]),
    layer('drip-edge', 'roof', roofUpgraded ? 'new' : hasDripEdge ? 'aged' : 'missing', hasDripEdge ? LAYER_COPY['drip-edge'].new : LAYER_COPY['drip-edge'].missing),
    layer('covering', 'roof', roofUpgraded ? 'new' : 'aged', LAYER_COPY.covering[coveringKey]),
    layer('ridge-vent', 'roof', roofUpgraded ? 'new' : 'missing', roofUpgraded ? LAYER_COPY['ridge-vent'].new : LAYER_COPY['ridge-vent'].missing),
    layer('insulation', 'attic', atticUpgraded ? 'new' : 'aged', {
      label: `R-${insulationRValue} ${insulationCopy.label.toLowerCase()}`,
      detail: insulationCopy.detail,
    }),
    layer('ceiling', 'attic', 'existing', LAYER_COPY.ceiling.existing),
  ]

  return {
    build,
    isTypical,
    covering,
    coveringWorn: !roofUpgraded,
    deck,
    deckAged: !roofUpgraded,
    underlayment,
    hasIceWater: roofUpgraded,
    hasDripEdge,
    hasRidgeVent: roofUpgraded,
    insulationRValue,
    insulationInches: INCHES_BY_R_VALUE[insulationRValue] ?? insulationRValue / 3,
    insulationNew: atticUpgraded,
    layers,
  }
}
