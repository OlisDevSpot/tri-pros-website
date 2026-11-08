import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { newDoublePane } from '@/features/trade-scenes/constants/system-parts'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { partState, wornValue } from '@/features/trade-scenes/lib/part-state'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

export interface GlassLook {
  color: string
  opacity: number
  roughness: number
}

// The build's new window takes the dark Low-E look, more opaque and with no wear; any other glass is the house's own glass,
// aged as its wear says. Working numbers, set by shot.
const NEW_GLASS_OPACITY = 0.8
const NEW_GLASS_ROUGHNESS = 0.08
const GLASS_OPACITY = 0.4
const GLASS_ROUGHNESS = 0.08

export function glassLook(glazing: ResolvedPart | undefined): GlassLook {
  if (glazing !== undefined && newDoublePane(glazing)) {
    return { color: HOME_PALETTE.glassNew, opacity: NEW_GLASS_OPACITY, roughness: NEW_GLASS_ROUGHNESS }
  }
  const { wear } = partState(glazing === undefined ? [] : [glazing], 'glazing')
  return {
    color: wornColor(HOME_PALETTE.glass, WEAR_LOOKS.window.glass, wear),
    opacity: Math.min(0.85, wornValue(GLASS_OPACITY, WEAR_LOOKS.window.glassOpacity, wear)),
    roughness: wornValue(GLASS_ROUGHNESS, WEAR_LOOKS.window.glassRoughness, wear),
  }
}
