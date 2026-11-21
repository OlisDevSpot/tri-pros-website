import type { SurfaceTexture, TextureMapChoice, TextureSetId } from '@/features/trade-scenes/types'

// A key, not a frozen tag: applyGhost writes into the same material userData.
export const SOLID_MAP_KEY = 'solidMap'

export const TEXTURE_SET_IDS = [
  'shingle',
  'stucco',
  'sod-healthy',
  'sod-worn',
  'turf',
  'gravel',
  'mulch',
  'concrete',
  'asphalt',
  'asphalt-worn',
  'pavers-courtyard',
  'pavers-wave',
  'pavers-herringbone',
  'pavers-ashlar',
  'pavers-small-herringbone',
  'pavers-interlocking',
  'pavers-tumbled',
  'fiber-blown',
  'fiber-batt',
] as const

// Slugs of the colour blends baked for the Courtyard pavers; the first is the default.
const COURTYARD_BLENDS = [
  'dark-gray-pewter-charcoal',
  'gray-charcoal',
  'dark-gray-copper-charcoal',
  'gray-moss-charcoal',
  'adobe-copper-mocha',
  'sand-stone-mocha',
  'sand-copper-stone',
  'cream-brown-charcoal',
  'cream-terracotta-brown',
  'tuscan',
] as const

interface TextureSet {
  tileMetres: number
  maps: readonly ('own' | 'grey')[]
  blends?: readonly string[]
  macro: boolean
}

export const TEXTURE_SETS: Record<TextureSetId, TextureSet> = {
  'shingle': { tileMetres: 1.2, maps: ['grey'], macro: false },
  'stucco': { tileMetres: 2, maps: ['grey'], macro: false },
  'sod-healthy': { tileMetres: 2, maps: ['own'], macro: true },
  'sod-worn': { tileMetres: 2, maps: ['own'], macro: true },
  'turf': { tileMetres: 1.5, maps: ['own'], macro: false },
  'gravel': { tileMetres: 2, maps: ['own', 'grey'], macro: true },
  'mulch': { tileMetres: 2, maps: ['own', 'grey'], macro: true },
  'concrete': { tileMetres: 2, maps: ['own', 'grey'], macro: true },
  'asphalt': { tileMetres: 2, maps: ['own', 'grey'], macro: true },
  'asphalt-worn': { tileMetres: 3, maps: ['own'], macro: true },
  'pavers-courtyard': { tileMetres: 2.44, maps: [], blends: COURTYARD_BLENDS, macro: true },
  'pavers-wave': { tileMetres: 1, maps: ['own', 'grey'], macro: true },
  'pavers-herringbone': { tileMetres: 1, maps: ['own', 'grey'], macro: true },
  'pavers-ashlar': { tileMetres: 1.6, maps: ['own', 'grey'], macro: true },
  'pavers-small-herringbone': { tileMetres: 1.6, maps: ['own', 'grey'], macro: true },
  'pavers-interlocking': { tileMetres: 1.6, maps: ['own', 'grey'], macro: true },
  'pavers-tumbled': { tileMetres: 2, maps: ['own', 'grey'], macro: true },
  'fiber-blown': { tileMetres: 1, maps: ['own'], macro: false },
  'fiber-batt': { tileMetres: 0.9, maps: ['own'], macro: false },
}

// A grey map is tinted by multiplying, so it is baked bright and lifted back by this factor.
export const GREY_MAP_LIFT = 1.6

// Baked roughness maps are scaled to this mean so the material's roughness value stays the knob.
export const ROUGHNESS_MAP_MEAN = 0.85

export const OPENING_TEXTURE_SETS: readonly { set: TextureSetId, map: TextureMapChoice }[] = [
  { set: 'shingle', map: 'grey' },
  { set: 'stucco', map: 'grey' },
  { set: 'sod-healthy', map: 'own' },
  { set: 'concrete', map: 'own' },
  { set: 'asphalt', map: 'own' },
  { set: 'mulch', map: 'own' },
]

// A stucco home's body surfaces: plaster as a grey detail map under the paint's own colour.
export const STUCCO_TEXTURE: SurfaceTexture = { set: 'stucco', map: 'grey' }
export const CONCRETE_TEXTURE: SurfaceTexture = { set: 'concrete', map: 'own' }
