import { Color, SRGBColorSpace } from 'three'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'

const hsl = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace)
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const FROM = hsl(HOME_PALETTE.stucco)

// One fixed tone would paint every worn home the same, whatever its colours: a cream fade laid over a navy wall reads as pale
// discs, not faded navy. Each colour takes the move the default wall makes to its hand-tuned tone instead, so the default house
// wears as it always has and any other keeps its own colour.
function movedLike(tuned: string): (hex: string) => string {
  const to = hsl(tuned)
  return (hex) => {
    const { h, s, l } = hsl(hex)
    return `#${new Color().setHSL((h + to.h - FROM.h + 1) % 1, clamp(s * (to.s / FROM.s)), clamp(l + to.l - FROM.l), SRGBColorSpace).getHexString()}`
  }
}

export const paintChalk = movedLike(WEAR_LOOKS.paint.chalk)

// The sun's uneven fade: the same paint gone further, lighter in its own hue.
export const paintFade = movedLike(WEAR_LOOKS.paint.blotchColor)
