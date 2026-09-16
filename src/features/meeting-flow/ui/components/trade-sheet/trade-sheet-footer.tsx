'use client'

import { useRef } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { hasStoredEntry } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeSheetFooterProps {
  tradeId: string
}

/**
 * Remove is reversible (open the trade and pick again), so it needs no confirm dialog.
 * Shown whenever the trade has a stored entry, items or not: reasons or a note alone
 * are kept on write, so this is the only way to take them off the project.
 * Remove unmounts itself once the trade is cleared, so focus moves to Done first
 * instead of falling to the dialog container.
 */
export function TradeSheetFooter({ tradeId }: TradeSheetFooterProps) {
  const selections = useTradeSelections()
  const { removeTrade } = useTradeActions()
  const { showTrade } = useTradeStage()
  const doneRef = useRef<HTMLButtonElement>(null)
  const stored = hasStoredEntry(selections, tradeId)

  function handleRemove() {
    doneRef.current?.focus()
    removeTrade(tradeId)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {stored
        ? <Button className="h-11" variant="ghost" onClick={handleRemove}>{SPECIALTIES_COPY.sheet.remove}</Button>
        : <span aria-hidden />}
      <Button ref={doneRef} className="h-11" onClick={() => showTrade(null)}>{SPECIALTIES_COPY.sheet.done}</Button>
    </div>
  )
}
