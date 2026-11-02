import type { ShingleColor } from '@/shared/modules/construction/core/types'

// Hex values are the mean of Owens Corning's swatch photos, so screen approximations only.
export const OWENS_CORNING_SHINGLES = [
  { id: 'amber', line: 'cool', name: 'Amber', hex: '#A79789', agedSri: 24 },
  { id: 'forest-brown', line: 'cool', name: 'Forest Brown', hex: '#685347', agedSri: 17 },
  { id: 'mojave', line: 'cool', name: 'Mojave', hex: '#8D7159', agedSri: 18 },
  { id: 'mountainside', line: 'cool', name: 'Mountainside', hex: '#5E5F5D', agedSri: 19 },
  { id: 'night-sky', line: 'cool', name: 'Night Sky', hex: '#4A474A', agedSri: 16 },
  { id: 'oyster-shell', line: 'cool', name: 'Oyster Shell', hex: '#ABA6A0', agedSri: 24 },
  { id: 'sand-castle', line: 'cool', name: 'Sand Castle', hex: '#8D7D6B', agedSri: 17 },
  { id: 'shasta-white', line: 'cool', name: 'Shasta White', hex: '#B1B1AE', agedSri: 29 },
  { id: 'sierra-gray', line: 'cool', name: 'Sierra Gray', hex: '#959794', agedSri: 20 },
  { id: 'summerwood', line: 'cool', name: 'Summerwood', hex: '#686359', agedSri: 17 },
  { id: 'cliffside-gray', line: 'cool-plus', name: 'Cliffside Gray', hex: '#807E72', agedSri: 21 },
  { id: 'copper-trail', line: 'cool-plus', name: 'Copper Trail', hex: '#745E52', agedSri: 22 },
  { id: 'golden-meadow', line: 'cool-plus', name: 'Golden Meadow', hex: '#A68B6A', agedSri: 22 },
  { id: 'midnight', line: 'cool-plus', name: 'Midnight', hex: '#5E5A5B', agedSri: 20 },
  { id: 'mystic-gray', line: 'cool-plus', name: 'Mystic Gray', hex: '#757D7D', agedSri: 23 },
  { id: 'prairie-wood', line: 'cool-plus', name: 'Prairie Wood', hex: '#836C59', agedSri: 21 },
  { id: 'rolling-stone', line: 'cool-plus', name: 'Rolling Stone', hex: '#676161', agedSri: 22 },
] as const satisfies readonly ShingleColor[]

export type OwensCorningColorId = (typeof OWENS_CORNING_SHINGLES)[number]['id']

// Owens Corning's statement of the City of LA rule, not checked against the LA code.
export const LA_MIN_AGED_SRI = 20
