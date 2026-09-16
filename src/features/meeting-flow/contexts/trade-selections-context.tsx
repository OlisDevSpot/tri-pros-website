'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { createContext, use } from 'react'

/** The selection shadow. A new array on every edit; untouched entries keep their identity. */
export const TradeSelectionsContext = createContext<TradeSelection[] | null>(null)

export function useTradeSelections(): TradeSelection[] {
  const ctx = use(TradeSelectionsContext)
  if (!ctx) {
    throw new Error('useTradeSelections must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
