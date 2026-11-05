import { Color } from 'three'

import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'

const clamp = (channel: number) => Math.min(1, Math.max(0, channel))

/**
 * The Worn look sits at `WEAR_AMOUNT.worn`. Past it the worn tone keeps its hue and saturation and only its lightness runs on:
 * extrapolating each channel turns a near-white trim toward gold, because the blue falls faster than the red.
 */
export function wornColor(fresh: string, worn: string, wear: number): string {
  const t = wear / WEAR_AMOUNT.worn
  const from = new Color(fresh)
  const to = new Color(worn)
  if (t <= 1) {
    const color = from.lerp(to, t)
    return `#${color.setRGB(clamp(color.r), clamp(color.g), clamp(color.b)).getHexString()}`
  }
  const start = from.getHSL({ h: 0, s: 0, l: 0 })
  const end = to.getHSL({ h: 0, s: 0, l: 0 })
  return `#${new Color().setHSL(end.h, end.s, clamp(end.l + (end.l - start.l) * (t - 1))).getHexString()}`
}
