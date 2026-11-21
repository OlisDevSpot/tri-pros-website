import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { WEAR_AMOUNT, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { wornValue } from '@/features/trade-scenes/lib/part-state'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

// Good draws exactly as New, so a gutter shows no wear until Fair.
export function gutterLook(hex: string, wear: Wear): { color: string, roughness: number } {
  const { grime, grimeShare, roughness } = WEAR_LOOKS.gutter
  const amount = wear === 'good' ? 0 : WEAR_AMOUNT[wear]
  return {
    color: wornColor(hex, grime, amount * grimeShare),
    roughness: wornValue(roughness.new, roughness.worn, amount),
  }
}
