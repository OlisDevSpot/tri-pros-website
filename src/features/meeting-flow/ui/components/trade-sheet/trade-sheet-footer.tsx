'use client'

import { useRef } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeSheetFooterProps {
  tradeId: string
}

/**
 * Remove is reversible (open the trade and pick again), so it needs no confirm dialog.
 * Remove unmounts itself once the trade is cleared, so focus moves to Done first
 * instead of falling to the dialog container.
 */
export function TradeSheetFooter({ tradeId }: TradeSheetFooterProps) {
  const { selections, clearTrade } = useTradeSelection()
  const { closeTrade } = useTradeSheet()
  const doneRef = useRef<HTMLButtonElement>(null)
  const selected = isTradeSelected(selections, tradeId)

  function handleRemove() {
    doneRef.current?.focus()
    clearTrade(tradeId)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {selected
        ? <Button className="h-11" variant="ghost" onClick={handleRemove}>{SPECIALTIES_COPY.sheet.remove}</Button>
        : <span aria-hidden />}
      <Button ref={doneRef} className="h-11" onClick={closeTrade}>{SPECIALTIES_COPY.sheet.done}</Button>
    </div>
  )
}
