'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeSheetFooterProps {
  tradeId: string
}

/** Remove is reversible (open the trade and pick again), so it needs no confirm dialog. */
export function TradeSheetFooter({ tradeId }: TradeSheetFooterProps) {
  const { selections, clearTrade } = useTradeSelection()
  const { closeTrade } = useTradeSheet()
  const selected = isTradeSelected(selections, tradeId)

  return (
    <div className="flex items-center justify-between gap-3">
      {selected
        ? <Button variant="ghost" onClick={() => clearTrade(tradeId)}>{SPECIALTIES_COPY.sheet.remove}</Button>
        : <span aria-hidden />}
      <Button onClick={closeTrade}>{SPECIALTIES_COPY.sheet.done}</Button>
    </div>
  )
}
