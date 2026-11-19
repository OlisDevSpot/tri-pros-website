import type { GroundColor, GroundPattern } from '@/features/trade-scenes/constants/ground-appearances'
import type { GroundMaterialId, TextureSetId } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { GROUND_APPEARANCES } from '@/features/trade-scenes/constants/ground-appearances'
import { GROUND_MATERIALS } from '@/features/trade-scenes/constants/ground-materials'

const PATTERNS: Partial<Record<GroundMaterialId, readonly GroundPattern[]>> = GROUND_APPEARANCES

// Sod and asphalt past Fair have a texture of their own, in their own colours; Fair still reads as healthy.
const WORN_SETS: Partial<Record<TextureSetId, TextureSetId>> = { 'sod-healthy': 'sod-worn', 'asphalt': 'asphalt-worn' }

export function wornTextureSet(material: GroundMaterialId, wear: Wear | null): TextureSetId | null {
  const healthy = GROUND_MATERIALS[material].look.texture
  return healthy !== undefined && (wear === 'worn' || wear === 'failing') ? WORN_SETS[healthy] ?? null : null
}

export const packAppearance = (pattern: number, color: number): number => pattern << 4 | color

// The byte an appearance reads as; null for a material with one look. An index past the end of an edited list reads as the
// default. A colour index belongs to its pattern, so a pattern that no longer exists takes its default colour too.
export function canonicalAppearance(material: GroundMaterialId, appearance: number): number | null {
  const patterns = PATTERNS[material]
  if (patterns === undefined) {
    return null
  }
  const pattern = patterns[appearance >> 4]
  if (pattern === undefined) {
    return 0
  }
  return pattern.colors[appearance & 15] === undefined ? packAppearance(appearance >> 4, 0) : appearance
}

export function readAppearance(material: GroundMaterialId, appearance: number): { pattern: GroundPattern, color: GroundColor } | null {
  const canonical = canonicalAppearance(material, appearance)
  if (canonical === null) {
    return null
  }
  const pattern = PATTERNS[material]![canonical >> 4]
  return { pattern, color: pattern.colors[canonical & 15] }
}

// Worn asphalt keeps the worn texture's own colours, so it offers none.
export function appearanceOptions(material: GroundMaterialId, wear: Wear | null): readonly GroundPattern[] | null {
  return wornTextureSet(material, wear) === null ? PATTERNS[material] ?? null : null
}

export const hasAppearances = (material: GroundMaterialId, wear: Wear | null): boolean => appearanceOptions(material, wear) !== null
