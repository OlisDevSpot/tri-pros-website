'use client'

import type { TradeCatalogContextValue } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** The Notion catalog and the portfolio project index. Changes only when either read settles. */
export const TradeCatalogContext = createContext<TradeCatalogContextValue | null>(null)

export function useTradeCatalogContext(): TradeCatalogContextValue {
  const ctx = use(TradeCatalogContext)
  if (!ctx) {
    throw new Error('useTradeCatalogContext must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
