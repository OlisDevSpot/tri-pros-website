'use client'

import type { TradeStageState } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Which trade and photo are on stage. Changes when the rep shows another trade or photo, not on toggles. */
export const TradeStageContext = createContext<TradeStageState | null>(null)

export function useTradeStage(): TradeStageState {
  const ctx = use(TradeStageContext)
  if (!ctx) {
    throw new Error('useTradeStage must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
