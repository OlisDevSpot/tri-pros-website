'use client'

import type { TradeActions } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Edit actions. Stable: reading this context never re-renders on a toggle. */
export const TradeActionsContext = createContext<TradeActions | null>(null)

export function useTradeActions(): TradeActions {
  const ctx = use(TradeActionsContext)
  if (!ctx) {
    throw new Error('useTradeActions must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
