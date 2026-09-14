'use client'

import type { ReactNode } from 'react'
import type { MeetingFlowContext, OpenTradeOptions, SelectionItem, TradeSelectionContextValue, TradeSheetState } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tradeSheetParser } from '@/features/meeting-flow/constants/query-parsers'
import { SELECTION_WRITE_DEBOUNCE_MS } from '@/features/meeting-flow/constants/trade-selection'
import { TradeSelectionContext, TradeSheetContext } from '@/features/meeting-flow/contexts/trade-selection-context'
import { useTradeCatalog } from '@/features/meeting-flow/hooks/use-trade-catalog'
import {
  canonicalSelectionsJson,
  findTradeSelection,
  normalizeForWrite,
  withItemToggled,
  withNote,
  withoutTrade,
  withReasonToggled,
} from '@/features/meeting-flow/lib/trade-selection'
import { useDebounce } from '@/shared/hooks/use-debounce'

interface TradeSelectionProviderProps {
  flowContext: MeetingFlowContext
  children: ReactNode
}

/**
 * One source of truth for step 2 and any later step that opens a trade.
 *
 * Shadow: local `selections` seeded from `flowState.tradeSelections`. Re-seeded
 * when the server value changes to anything this provider did not write itself
 * (compared through `canonicalSelectionsJson`, since jsonb reorders keys), so a
 * stale refetch that lands after a newer write cannot roll the shadow back.
 * Write path: the debounced shadow, normalized (zero-item trades dropped), is
 * written once per distinct value after the first user action. Opening or
 * closing the sheet never writes. A write still pending when the view unmounts
 * is lost, as it was in the old step.
 */
export function TradeSelectionProvider({ flowContext, children }: TradeSelectionProviderProps) {
  const { onFlowStateChange } = flowContext
  const catalog = useTradeCatalog()

  const serverSelections = useMemo(
    () => flowContext.flowState?.tradeSelections ?? [],
    [flowContext.flowState?.tradeSelections],
  )
  const serverJson = useMemo(() => canonicalSelectionsJson(serverSelections), [serverSelections])

  const [selections, setSelections] = useState<TradeSelection[]>(serverSelections)
  const [seededFrom, setSeededFrom] = useState(serverJson)
  const [dirty, setDirty] = useState(false)
  const lastWrittenRef = useRef<string | null>(null)
  /** Every value this provider has written. An echo of any of them, including a stale one that lands after a newer write, never re-seeds. */
  const writtenRef = useRef<Set<string>>(new Set())

  // Render-phase adjustment (React: "storing information from previous renders").
  if (seededFrom !== serverJson) {
    setSeededFrom(serverJson)
    if (!writtenRef.current.has(serverJson)) {
      setSelections(serverSelections)
    }
  }

  const debounced = useDebounce(selections, SELECTION_WRITE_DEBOUNCE_MS)
  useEffect(() => {
    if (!dirty) {
      return
    }
    const normalized = normalizeForWrite(debounced)
    const json = canonicalSelectionsJson(normalized)
    if (json === lastWrittenRef.current || json === serverJson) {
      return
    }
    lastWrittenRef.current = json
    writtenRef.current.add(json)
    onFlowStateChange({ tradeSelections: normalized })
  }, [debounced, dirty, onFlowStateChange, serverJson])

  const tradesById = catalog.tradesById
  const resolveTrade = useCallback((tradeId: string, current: TradeSelection[]) => ({
    id: tradeId,
    name: tradesById.get(tradeId)?.name ?? findTradeSelection(current, tradeId)?.tradeName ?? tradeId,
  }), [tradesById])

  const toggleItem = useCallback((tradeId: string, item: SelectionItem) => {
    setDirty(true)
    setSelections(current => withItemToggled(current, resolveTrade(tradeId, current), item))
  }, [resolveTrade])

  const toggleReason = useCallback((tradeId: string, reason: string) => {
    setDirty(true)
    setSelections(current => withReasonToggled(current, resolveTrade(tradeId, current), reason))
  }, [resolveTrade])

  const setNote = useCallback((tradeId: string, note: string) => {
    setDirty(true)
    setSelections(current => withNote(current, resolveTrade(tradeId, current), note))
  }, [resolveTrade])

  const clearTrade = useCallback((tradeId: string) => {
    setDirty(true)
    setSelections(current => withoutTrade(current, tradeId))
  }, [])

  const [openTradeId, setOpenTradeId] = useQueryState('trade', tradeSheetParser)
  const [focusScopeId, setFocusScopeId] = useState<string | null>(null)

  const openTrade = useCallback((tradeId: string, options?: OpenTradeOptions) => {
    setFocusScopeId(options?.focusScopeId ?? null)
    void setOpenTradeId(tradeId)
  }, [setOpenTradeId])

  const closeTrade = useCallback(() => {
    setFocusScopeId(null)
    void setOpenTradeId(null)
  }, [setOpenTradeId])

  const selectionValue = useMemo<TradeSelectionContextValue>(
    () => ({ selections, catalog, toggleItem, toggleReason, setNote, clearTrade }),
    [selections, catalog, toggleItem, toggleReason, setNote, clearTrade],
  )

  const sheetValue = useMemo<TradeSheetState>(
    () => ({ openTradeId, focusScopeId, openTrade, closeTrade }),
    [openTradeId, focusScopeId, openTrade, closeTrade],
  )

  return (
    <TradeSelectionContext value={selectionValue}>
      <TradeSheetContext value={sheetValue}>
        {children}
      </TradeSheetContext>
    </TradeSelectionContext>
  )
}
