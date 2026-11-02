'use client'

import type { SceneChange, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback } from 'react'

import { applySceneChange } from '@/features/trade-scenes/lib/apply-scene-change'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

// The one write every control makes, so a change and the picks it can no longer take land together, and saving has one
// place to attach.
export function useApplySceneChange(): (change: SceneChange) => void {
  const store = useSceneInputsApi<TradeSceneInputs>()
  return useCallback((change: SceneChange) => {
    store.setState(state => applySceneChange(state, change, currentYear()))
  }, [store])
}
