'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import { memo, useCallback, useEffect, useState } from 'react'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { findTradeSelection } from '@/features/meeting-flow/lib/trade-selection'
import { TradeSheetBody } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body'
import { TradeSheetFooter } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-footer'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'

/**
 * Mounted once by the meeting-flow view. Every opener on every step goes
 * through `useTradeStage().showTrade`, so this is the only place a trade sheet
 * exists. The body is keyed on the trade id and nothing else: a toggle inside
 * never remounts it. The last trade stays rendered while the primitive
 * animates closed, so the panel does not blank mid-exit.
 */
function TradeSheetHostImpl() {
  const { stageTradeId, showTrade } = useTradeStage()
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()

  const [shownTradeId, setShownTradeId] = useState<string | null>(stageTradeId)
  if (stageTradeId !== null && stageTradeId !== shownTradeId) {
    setShownTradeId(stageTradeId)
  }

  const trade = shownTradeId ? catalog.tradesById.get(shownTradeId) : undefined
  const stored = shownTradeId ? findTradeSelection(selections, shownTradeId) : undefined
  const title = trade?.name ?? stored?.tradeName ?? ''
  const description = trade?.type ? TRADE_CATEGORY_LABELS[trade.type as TradeCategory] : undefined

  // An id in the URL that neither the loaded catalog nor the stored selections know
  // has nothing to show and no title; close it instead of opening an empty dialog.
  const isUnknownTrade = stageTradeId !== null
    && !catalog.isLoading
    && !catalog.error
    && !catalog.tradesById.has(stageTradeId)
    && findTradeSelection(selections, stageTradeId) === undefined

  useEffect(() => {
    if (isUnknownTrade) {
      showTrade(null)
    }
  }, [isUnknownTrade, showTrade])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      showTrade(null)
    }
  }, [showTrade])

  return (
    <ResponsiveSheet
      contentClassName="lg:max-w-xl"
      description={description}
      footer={shownTradeId && !catalog.isLoading && !catalog.error ? <TradeSheetFooter tradeId={shownTradeId} /> : undefined}
      open={stageTradeId !== null && !isUnknownTrade}
      title={title}
      onOpenChange={handleOpenChange}
    >
      {shownTradeId && <TradeSheetBody key={shownTradeId} tradeId={shownTradeId} />}
    </ResponsiveSheet>
  )
}

export const TradeSheetHost = memo(TradeSheetHostImpl)
