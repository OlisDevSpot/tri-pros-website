import type { StandardShingleColor } from '@/shared/modules/construction/core/types'

// The distributor's generic bundles are only "very similar" to these Owens Corning colours, so the swatches are screen
// approximations, and the names carry no brand.
export const STANDARD_SHINGLES = [
  { id: 'dark-brown', name: 'Dark brown', hex: '#6A5548', coolTwin: 'forest-brown' },
  { id: 'grey-brown', name: 'Grey brown', hex: '#69635A', coolTwin: 'summerwood' },
  { id: 'light-brown', name: 'Light brown', hex: '#90806E', coolTwin: 'sand-castle' },
] as const satisfies readonly StandardShingleColor[]

export type StandardShingleColorId = (typeof STANDARD_SHINGLES)[number]['id']
