import { Color, SRGBColorSpace } from 'three'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'

const hsl = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace)
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const FROM = hsl(HOME_PALETTE.stucco)
const TO = hsl(WEAR_LOOKS.paint.chalk)

// One fixed chalk would paint every worn home the same, whatever its colours. Each colour takes the move the default wall
// makes to its hand-tuned chalk instead, so the default house wears as it always has and any other keeps its own colour.
export function paintChalk(hex: string): string {
  const { h, s, l } = hsl(hex)
  return `#${new Color().setHSL((h + TO.h - FROM.h + 1) % 1, clamp(s * (TO.s / FROM.s)), clamp(l + TO.l - FROM.l), SRGBColorSpace).getHexString()}`
}
