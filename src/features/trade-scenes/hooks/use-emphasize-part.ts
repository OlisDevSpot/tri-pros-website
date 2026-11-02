'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback } from 'react'

import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

// A tap on a part (in the scene, on its pin or in the list) emphasises it; a second tap on the same part lets it go.
export function useEmphasizePart(): (partId: string) => void {
  const store = useSceneInputsApi<TradeSceneInputs>()
  return useCallback((partId: string) => {
    store.setState(state => ({ emphasizedPart: state.emphasizedPart === partId ? null : partId }))
  }, [store])
}
