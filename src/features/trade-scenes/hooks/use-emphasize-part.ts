'use client'

import type { SystemPartId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback } from 'react'

import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

// A tap on a system part (on its pin or in the card's list) emphasises it; a second tap on the same part lets it go.
export function useEmphasizePart(): (partId: SystemPartId) => void {
  const store = useSceneInputsApi<TradeSceneInputs>()
  return useCallback((partId: SystemPartId) => {
    store.setState(state => ({ emphasizedPart: state.emphasizedPart === partId ? null : partId }))
  }, [store])
}
