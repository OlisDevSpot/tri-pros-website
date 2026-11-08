import type { StandardShingleColor } from '@/shared/modules/construction/core/types'

// The distributor's generic bundles are only "very similar" to these Owens Corning colours, so the swatches are screen
// approximations, and the names carry no brand.
export const STANDARD_SHINGLES = [
  { id: 'dark-brown', name: 'Dark brown', hex: '#685347', coolTwin: 'forest-brown' },
  { id: 'grey-brown', name: 'Grey brown', hex: '#686359', coolTwin: 'summerwood' },
  { id: 'light-brown', name: 'Light brown', hex: '#8D7D6B', coolTwin: 'sand-castle' },
] as const satisfies readonly StandardShingleColor[]

export type StandardShingleColorId = (typeof STANDARD_SHINGLES)[number]['id']
