'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import { useCallback, useState } from 'react'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { findTradeSelection } from '@/features/meeting-flow/lib/trade-selection'
import { TradeSheetBody } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body'
import { TradeSheetFooter } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-footer'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'

/**
 * Mounted once by the meeting-flow view. Every opener on every step goes
 * through `useTradeSheet().openTrade`, so this is the only place a trade sheet
 * exists. The body is keyed on the trade id and nothing else: a toggle inside
 * never remounts it. The last trade stays rendered while the primitive
 * animates closed, so the panel does not blank mid-exit.
 */
export function TradeSheetHost() {
  const { openTradeId, focusScopeId, closeTrade } = useTradeSheet()
  const { selections, catalog } = useTradeSelection()

  const [shownTradeId, setShownTradeId] = useState<string | null>(openTradeId)
  if (openTradeId !== null && openTradeId !== shownTradeId) {
    setShownTradeId(openTradeId)
  }

  const trade = shownTradeId ? catalog.tradesById.get(shownTradeId) : undefined
  const stored = shownTradeId ? findTradeSelection(selections, shownTradeId) : undefined
  const title = trade?.name ?? stored?.tradeName ?? ''
  const description = trade?.type ? TRADE_CATEGORY_LABELS[trade.type as TradeCategory] : undefined

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeTrade()
    }
  }, [closeTrade])

  const handleOpenAutoFocus = useCallback((event: Event) => {
    if (focusScopeId) {
      event.preventDefault()
    }
  }, [focusScopeId])

  return (
    <ResponsiveSheet
      contentClassName="sm:max-w-xl"
      description={description}
      footer={shownTradeId ? <TradeSheetFooter tradeId={shownTradeId} /> : undefined}
      open={openTradeId !== null}
      title={title}
      onOpenAutoFocus={handleOpenAutoFocus}
      onOpenChange={handleOpenChange}
    >
      {shownTradeId && <TradeSheetBody key={shownTradeId} focusScopeId={focusScopeId} tradeId={shownTradeId} />}
    </ResponsiveSheet>
  )
}
