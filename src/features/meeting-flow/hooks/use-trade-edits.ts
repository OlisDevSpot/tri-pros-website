'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { UNDO_TOAST_MS } from '@/features/meeting-flow/constants/trade-selection'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { isOnlyItem } from '@/features/meeting-flow/lib/trade-selection'

/**
 * Edits with the step's removal rules (spec §4.2.3): unticking a trade's only item removes the
 * trade (items, reasons and note) and offers Undo, which restores the whole entry. Callers pass the
 * current entry, so the callbacks stay stable and read no selections.
 */
export function useTradeEdits() {
  const { toggleItem, removeTrade, restoreTrade } = useTradeActions()

  const removeWithUndo = useCallback((entry: TradeSelection) => {
    removeTrade(entry.tradeId)
    toast(SPECIALTIES_COPY.undo.tradeRemoved(entry.tradeName), {
      duration: UNDO_TOAST_MS,
      action: { label: SPECIALTIES_COPY.undo.action, onClick: () => restoreTrade(entry) },
    })
  }, [removeTrade, restoreTrade])

  const toggleWork = useCallback((tradeId: string, entry: TradeSelection | undefined, item: SelectionItem) => {
    if (entry && isOnlyItem(entry, item.id)) {
      removeWithUndo(entry)
      return
    }
    toggleItem(tradeId, item)
  }, [toggleItem, removeWithUndo])

  return useMemo(() => ({ toggleWork, removeWithUndo }), [toggleWork, removeWithUndo])
}
