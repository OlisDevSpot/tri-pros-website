'use client'

import type { TradeSelectionContextValue, TradeSheetState } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Selections, catalog, and the edit actions. Changes on every toggle. */
export const TradeSelectionContext = createContext<TradeSelectionContextValue | null>(null)

export function useTradeSelection(): TradeSelectionContextValue {
  const ctx = use(TradeSelectionContext)
  if (!ctx) {
    throw new Error('useTradeSelection must be used inside <TradeSelectionProvider>')
  }
  return ctx
}

/** Which trade sheet is open. Split from the selection context so openers do not re-render on toggles and tiles do not re-render on open. */
export const TradeSheetContext = createContext<TradeSheetState | null>(null)

export function useTradeSheet(): TradeSheetState {
  const ctx = use(TradeSheetContext)
  if (!ctx) {
    throw new Error('useTradeSheet must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
