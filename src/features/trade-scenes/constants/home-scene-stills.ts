import type { Weather } from '@/shared/modules/construction/core/types'

// Captured from the scene itself (the existing home, home framing), so a device without 3D still sees the same house in the same weather.
export const HOME_SCENE_STILLS = {
  normal: '/scenes/stills/normal.webp',
  summer: '/scenes/stills/summer.webp',
  winter: '/scenes/stills/winter.webp',
  rain: '/scenes/stills/rain.webp',
} as const satisfies Record<Weather, string>
