import type { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import type { GroundLayer, GroundMaterialId, LotLayout, TextureMapChoice, TextureSetId, WornStep } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { GROUND_MATERIALS } from '@/features/trade-scenes/constants/ground-materials'
import { GROUND_WEAR_LOOKS } from '@/features/trade-scenes/constants/ground-wear-looks'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { readAppearance, wornTextureSet } from '@/features/trade-scenes/lib/ground-appearance'
import { groundStripKeys } from '@/features/trade-scenes/lib/shown-ground'

// `shade` is a wear shift toward a palette tone, as far as wornColor takes it at `amount`; `marks` names the overlay of
// bare soil, stains and cracks that lies over the texture.
export interface GroundDraw {
  set: TextureSetId
  map: TextureMapChoice
  mapTint: string | null
  shade: { tint: keyof typeof LOT_PALETTE, amount: number } | null
  marks: 'lawn' | 'paving' | null
}

const LAYERS: readonly GroundLayer[] = ['existing', 'proposed']

export const isWornStep = (wear: Wear | null): wear is WornStep => wear === 'fair' || wear === 'worn' || wear === 'failing'

// A wear step's mix is the share of the way to its tone that the Worn look reaches.
const shadeOf = ({ tint, mix }: { tint: keyof typeof LOT_PALETTE, mix: number }) => ({ tint, amount: mix * WEAR_AMOUNT.worn })

// Lawn and paving at Fair have no worn texture: sod and asphalt take the Fair tone, and paving's stains lie in its marks.
export function groundDraw(material: GroundMaterialId, wear: Wear | null, appearance: number): GroundDraw | null {
  const { look, wearLook } = GROUND_MATERIALS[material]
  if (look.texture === undefined) {
    return null
  }
  const step = isWornStep(wear) ? wear : null
  const marks = step !== null && (wearLook === 'lawn' || wearLook === 'paving') ? wearLook : null
  const worn = wornTextureSet(material, wear)
  if (worn !== null) {
    return { set: worn, map: 'own', mapTint: null, shade: null, marks }
  }
  const shaded = step !== null && (wearLook === 'loose' || (step === 'fair' && wornTextureSet(material, 'worn') !== null))
  const shade = shaded && wearLook !== null ? shadeOf(GROUND_WEAR_LOOKS[wearLook][step]) : null
  const picked = readAppearance(material, appearance)
  if (picked === null) {
    return { set: look.texture, map: 'own', mapTint: null, shade, marks }
  }
  const { pattern, color } = picked
  const map: TextureMapChoice = color.blend !== undefined ? { blend: color.blend } : color.mapTint !== null ? 'grey' : 'own'
  return { set: pattern.set, map, mapTint: color.mapTint, shade, marks }
}

// Every set the strips of either layer draw, once each, so the layer off screen keeps its maps through a toggle. The lot
// carries no house mask, so a tile under the house counts as drawn.
export function lotTextureRequests(lot: LotLayout): readonly { set: TextureSetId, map: TextureMapChoice }[] {
  const unmasked = new Uint8Array(lot.cols * lot.rows)
  const requests = new Map<string, { set: TextureSetId, map: TextureMapChoice }>()
  for (const layer of LAYERS) {
    for (const { material, wear, appearance } of groundStripKeys(lot, layer, unmasked)) {
      const draw = groundDraw(material, wear, appearance)
      if (draw !== null) {
        requests.set(`${draw.set}/${typeof draw.map === 'string' ? draw.map : draw.map.blend}`, { set: draw.set, map: draw.map })
      }
    }
  }
  return [...requests.values()]
}
