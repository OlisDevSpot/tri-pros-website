import type { WindowFrameColor } from '@/shared/modules/construction/core/types'

export const WINDOW_FRAME_COLOR_IDS = ['white', 'black', 'black-white'] as const

export type WindowFrameColorId = (typeof WINDOW_FRAME_COLOR_IDS)[number]

// Vinyl comes in these three; the white is the frame the scene has always drawn.
export const WINDOW_FRAME_COLORS = {
  'white': { name: 'White', outside: '#f3ece0', inside: '#f3ece0' },
  // A working number, set by shot.
  'black': { name: 'Black', outside: '#2b2b2c', inside: '#2b2b2c' },
  'black-white': { name: 'Black outside, white inside', outside: '#2b2b2c', inside: '#f3ece0' },
} as const satisfies Record<WindowFrameColorId, WindowFrameColor>
