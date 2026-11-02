import { COVERING_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

type CoveringKey = keyof typeof COVERING_COLORS

// An installed Owens Corning colour is the covering's new tone; it wears toward the covering's own worn tone.
export function coveringTone(material: CoveringKey | null, fallback: CoveringKey, wear: number, installedTone: string | null): string {
  const colours = COVERING_COLORS[material ?? fallback] ?? COVERING_COLORS[fallback]
  return wornColor(installedTone ?? colours.new, colours.worn, wear)
}
