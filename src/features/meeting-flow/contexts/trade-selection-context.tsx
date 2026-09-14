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

/**
 * Which trade sheet is open. Split from the selection context so opening or closing a sheet does not re-render
 * components that read only selection state (the sheet body's groups, chips, and note). Components that read both
 * (tiles, the project strip, the sheet host, footer, and pairing card) re-render on toggles and on open.
 */
export const TradeSheetContext = createContext<TradeSheetState | null>(null)

export function useTradeSheet(): TradeSheetState {
  const ctx = use(TradeSheetContext)
  if (!ctx) {
    throw new Error('useTradeSheet must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
