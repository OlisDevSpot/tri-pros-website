'use client'

import type { SpotChipFree } from '@/features/trade-scenes/lib/spot-chip-placement'

import { useControlsOpen } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { spotChipFree } from '@/features/trade-scenes/lib/spot-chip-placement'

// The systems rail stands only while the Systems section is open.
export function useSpotChipFree(): SpotChipFree {
  const { area, stage, shape } = useSceneVisibleArea()
  const open = useControlsOpen()
  return spotChipFree({ stage, area, railShown: open === 'systems', portrait: shape === 'portrait' })
}
