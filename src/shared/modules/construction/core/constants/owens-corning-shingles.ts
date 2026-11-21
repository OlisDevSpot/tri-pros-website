import type { ShingleColor } from '@/shared/modules/construction/core/types'

// Hex values are the linear-light mean of Owens Corning's own swatch images (what the eye sees from the street), so screen approximations only.
export const OWENS_CORNING_SHINGLES = [
  { id: 'amber', line: 'cool', name: 'Amber', hex: '#A9998C', agedSri: 24 },
  { id: 'forest-brown', line: 'cool', name: 'Forest Brown', hex: '#6A5548', agedSri: 17 },
  { id: 'mojave', line: 'cool', name: 'Mojave', hex: '#8F745B', agedSri: 18 },
  { id: 'mountainside', line: 'cool', name: 'Mountainside', hex: '#5E5F5D', agedSri: 19 },
  { id: 'night-sky', line: 'cool', name: 'Night Sky', hex: '#4B474A', agedSri: 16 },
  { id: 'oyster-shell', line: 'cool', name: 'Oyster Shell', hex: '#ACA7A1', agedSri: 24 },
  { id: 'sand-castle', line: 'cool', name: 'Sand Castle', hex: '#90806E', agedSri: 17 },
  { id: 'shasta-white', line: 'cool', name: 'Shasta White', hex: '#B1B2AE', agedSri: 29 },
  { id: 'sierra-gray', line: 'cool', name: 'Sierra Gray', hex: '#999B98', agedSri: 20 },
  { id: 'summerwood', line: 'cool', name: 'Summerwood', hex: '#69635A', agedSri: 17 },
  { id: 'cliffside-gray', line: 'cool-plus', name: 'Cliffside Gray', hex: '#818076', agedSri: 21 },
  { id: 'copper-trail', line: 'cool-plus', name: 'Copper Trail', hex: '#755E52', agedSri: 22 },
  { id: 'golden-meadow', line: 'cool-plus', name: 'Golden Meadow', hex: '#A78C6C', agedSri: 22 },
  { id: 'midnight', line: 'cool-plus', name: 'Midnight', hex: '#605B5D', agedSri: 20 },
  { id: 'mystic-gray', line: 'cool-plus', name: 'Mystic Gray', hex: '#777E7F', agedSri: 23 },
  { id: 'prairie-wood', line: 'cool-plus', name: 'Prairie Wood', hex: '#856D58', agedSri: 21 },
  { id: 'rolling-stone', line: 'cool-plus', name: 'Rolling Stone', hex: '#696362', agedSri: 22 },
] as const satisfies readonly ShingleColor[]

export type OwensCorningColorId = (typeof OWENS_CORNING_SHINGLES)[number]['id']

// Owens Corning's statement of the City of LA rule, not checked against the LA code.
export const LA_MIN_AGED_SRI = 20
