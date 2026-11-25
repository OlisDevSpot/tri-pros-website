import type { GroundLayer, GroundMaterialId, LotLayout } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { GROUND_MATERIALS, GROUND_WEAR_INDEX, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { canonicalAppearance, wornTextureSet } from '@/features/trade-scenes/lib/ground-appearance'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { groundWearAt } from '@/features/trade-scenes/lib/ground-wear-at'

export interface GroundStripKey {
  material: GroundMaterialId
  wear: Wear | null
  appearance: number
}

// One more than the highest wear index, so material, wear and an appearance byte pack into one sortable number.
const WEAR_SLOTS = GROUND_WEAR_INDEX.failing + 1
const APPEARANCE_SLOTS = 256

// What the build installs is New; ground the build keeps shows its Today wear and appearance.
export function shownGround(lot: LotLayout, layer: GroundLayer, i: number): { material: number, wear: number, appearance: number } {
  if (layer === 'proposed' && lot.proposed[i] !== PROPOSED_KEEP) {
    return { material: lot.proposed[i], wear: GROUND_WEAR_INDEX.new, appearance: lot.appearance.proposed[i] }
  }
  return { material: lot.existing[i], wear: lot.wear[i], appearance: lot.appearance.existing[i] }
}

// New looks as Good does, and a wearing tile with no wear set reads Good.
export function drawnWear(id: GroundMaterialId, wear: number): number {
  return GROUND_MATERIALS[id].wears ? Math.max(wear, GROUND_WEAR_INDEX.good) : 0
}

// A byte the material's list cannot name draws as the look it falls back to, and a worn texture keeps its own colours, so
// neither a stale byte nor a colour under worn asphalt splits a strip.
export function drawnAppearance(id: GroundMaterialId, wear: Wear | null, appearance: number): number {
  return wornTextureSet(id, wear) === null ? canonicalAppearance(id, appearance) ?? 0 : 0
}

// Sod at Good is left out: the ground strip is the lawn.
export function groundStripKeys(lot: LotLayout, layer: GroundLayer, mask: Uint8Array): readonly GroundStripKey[] {
  const keys = new Set<number>()
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      continue
    }
    const shown = shownGround(lot, layer, i)
    const id = groundMaterialAt(shown.material)
    if (id === null) {
      continue
    }
    const wear = drawnWear(id, shown.wear)
    if (id === 'sod' && wear === GROUND_WEAR_INDEX.good) {
      continue
    }
    keys.add((shown.material * WEAR_SLOTS + wear) * APPEARANCE_SLOTS + drawnAppearance(id, groundWearAt(wear), shown.appearance))
  }
  return [...keys].sort((a, b) => a - b).map(key => ({
    material: groundMaterialAt(Math.floor(key / (WEAR_SLOTS * APPEARANCE_SLOTS)))!,
    wear: groundWearAt(Math.floor(key / APPEARANCE_SLOTS) % WEAR_SLOTS),
    appearance: key % APPEARANCE_SLOTS,
  }))
}
