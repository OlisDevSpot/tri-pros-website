import { Color } from 'three'

import { HOME_THERMAL_PALETTE } from '@/features/trade-scenes/constants/home-temperatures'
import { samplePalette } from '@/shared/components/scene/lib/sample-palette'

// Linear, like the shader's stops, so a flat-painted figure or decal lands on the same colour as the shaded surfaces.
const STOPS = HOME_THERMAL_PALETTE.map((hex) => {
  const color = new Color(hex)
  return [color.r, color.g, color.b] as const
})

/** `t` is a temperature already on the fixed scale, 0..1. */
export function thermalPaintColor(t: number, target: Color = new Color()): Color {
  const [r, g, b] = samplePalette(STOPS, t)
  return target.setRGB(r, g, b)
}
