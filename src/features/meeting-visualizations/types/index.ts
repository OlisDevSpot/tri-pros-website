import type { Object3D } from 'three'
import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { InsulationLevel, RoofType } from '@/shared/modules/construction/core/constants/enums'

export type BuildState = 'today' | 'tri-pros'

/** The slice of `customer_profiles` the cutaway reads. Any field may be unknown in a meeting. */
export interface CutawayProfile {
  roofType: RoofType | null
  yearBuilt: YearBuiltRange | null
  insulationLevel: InsulationLevel | null
}

/** Which of the cutaway's trades the homeowner has in scope (from `flowStateJSON.tradeSelections`). */
export interface CutawayScope {
  roof: boolean
  attic: boolean
}

export type CoveringKind = 'shingle' | 'tile'
export type DeckKind = 'skip-sheathing' | 'solid'
export type UnderlaymentKind = 'felt' | 'synthetic'

export type LayerId
  = | 'rafters'
    | 'deck'
    | 'ice-water'
    | 'underlayment'
    | 'drip-edge'
    | 'covering'
    | 'ridge-vent'
    | 'insulation'
    | 'ceiling'

export type LayerGroup = 'roof' | 'attic'

/** `missing` layers are listed but not drawn: their absence is the point. */
export type LayerStatus = 'existing' | 'aged' | 'new' | 'missing'

export interface AssemblyLayer {
  id: LayerId
  group: LayerGroup
  status: LayerStatus
  label: string
  detail: string
}

export interface RoofAssembly {
  build: BuildState
  /** True when the profile was incomplete and the "today" state is an era-typical guess. */
  isTypical: boolean
  covering: CoveringKind
  coveringWorn: boolean
  deck: DeckKind
  deckAged: boolean
  underlayment: UnderlaymentKind
  hasIceWater: boolean
  hasDripEdge: boolean
  hasRidgeVent: boolean
  insulationRValue: number
  insulationInches: number
  insulationNew: boolean
  /** Inside-out order for the roof, then top-down for the attic. Drives the list, pins and explode order. */
  layers: AssemblyLayer[]
}

/**
 * Shared between the canvas and the DOM pin overlay without React state: the canvas writes
 * screen positions straight onto the pin elements each frame, so a pan never re-renders.
 */
export interface PinRegistry {
  anchors: Map<LayerId, Object3D>
  elements: Map<LayerId, HTMLElement>
}
