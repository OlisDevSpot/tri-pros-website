'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useRef } from 'react'

import { houseOpen } from '@/features/trade-scenes/lib/house-open'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

// Sticky: once a system has been looked into its textures stay loaded, so closing it again never drops what was fetched.
export function useSystemOpened(system: HomeSystemId): boolean {
  const opened = useRef(false)
  const now = useSceneInputs((state: TradeSceneInputs) => state.pickedSystem === system || houseOpen(state))
  if (now) {
    opened.current = true
  }
  return opened.current
}
