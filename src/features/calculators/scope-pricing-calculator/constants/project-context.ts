export const NUM_STORIES_OPTIONS = [1, 2, 3, 4] as const

// Only shingle and tile have tear-off rates; any other roof type would silently price at the tile rate.
export const CURRENT_ROOF_TYPES = ['shingle', 'tile'] as const

export const CURRENT_ROOF_TYPE_LABELS = {
  shingle: 'Shingle',
  tile: 'Tile',
} as const satisfies Record<typeof CURRENT_ROOF_TYPES[number], string>
