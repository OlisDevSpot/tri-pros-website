'use client'

import type { ReactNode } from 'react'
import type { MeetingFlowContext, SelectionItem, TradeActions, TradeCatalogContextValue, TradeStageState } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { tradeStageParser } from '@/features/meeting-flow/constants/query-parsers'
import { SELECTION_WRITE_DEBOUNCE_MS } from '@/features/meeting-flow/constants/trade-selection'
import { TradeActionsContext } from '@/features/meeting-flow/contexts/trade-actions-context'
import { TradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { TradeSelectionsContext } from '@/features/meeting-flow/contexts/trade-selections-context'
import { TradeStageContext } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useShowcaseProjects } from '@/features/meeting-flow/hooks/use-showcase-projects'
import { resolveStageTradeId } from '@/features/meeting-flow/lib/resolve-stage-trade'
import {
  canonicalSelectionsJson,
  findTradeSelection,
  normalizeForWrite,
  withItemToggled,
  withNote,
  withoutTrade,
  withReasonToggled,
  withTradeRestored,
} from '@/features/meeting-flow/lib/trade-selection'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'

interface TradeSelectionProviderProps {
  flowContext: MeetingFlowContext
  children: ReactNode
}

/**
 * One source of truth for step 2 and the meeting panel's Project section.
 *
 * Shadow: local `selections` seeded from `flowState.tradeSelections`. Re-seeded
 * when the server value changes to anything this provider did not write itself
 * (compared through `canonicalSelectionsJson`, since jsonb reorders keys), so a
 * stale refetch that lands after a newer write cannot roll the shadow back.
 *
 * Write path: after the first user action, the debounced shadow is normalized
 * (`normalizeForWrite`: empty entries the server does not hold are dropped) and
 * written when it differs from the server. A write is in flight from the moment
 * it is sent until the server echoes it; while in flight the same value is never
 * sent again. Once the echo has been seen, a later server value that is one of
 * this provider's own older writes is a rollback: the shadow keeps the newer value
 * and it is written again. A foreign server value re-seeds the shadow instead. A
 * write still inside the debounce window when the provider unmounts is sent from
 * the unmount cleanup.
 *
 * Four contexts, so each consumer re-renders only for what it reads: catalog +
 * portfolio projects (settles once), actions (stable), selections (every edit),
 * stage (when the rep shows another trade or photo).
 */
export function TradeSelectionProvider({ flowContext, children }: TradeSelectionProviderProps) {
  const { onFlowStateChange } = flowContext
  const catalog = useConstructionCatalog()
  const projects = useShowcaseProjects(catalog.scopesById)

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

  /** False from sending a write until the server echoes it. */
  const confirmedRef = useRef(true)
  /** Latest render's values, for the unmount cleanup. */
  const latestRef = useRef({ selections, serverSelections, serverJson, dirty, onFlowStateChange })
  useLayoutEffect(() => {
    latestRef.current = { selections, serverSelections, serverJson, dirty, onFlowStateChange }
  })

  const debounced = useDebounce(selections, SELECTION_WRITE_DEBOUNCE_MS)
  useEffect(() => {
    if (serverJson === lastWrittenRef.current) {
      confirmedRef.current = true
    }
    if (!dirty) {
      return
    }
    const normalized = normalizeForWrite(debounced, serverSelections)
    const json = canonicalSelectionsJson(normalized)
    if (json === serverJson) {
      return
    }
    // Same value as the last write: re-send only for a confirmed write rolled back to
    // an own older value. A foreign server value re-seeded the shadow, and `debounced`
    // still holds the previous value for one debounce window; writing it would clobber.
    if (json === lastWrittenRef.current && (!confirmedRef.current || !writtenRef.current.has(serverJson))) {
      return
    }
    lastWrittenRef.current = json
    confirmedRef.current = false
    writtenRef.current.add(json)
    onFlowStateChange({ tradeSelections: normalized })
  }, [debounced, dirty, onFlowStateChange, serverJson, serverSelections])

  useEffect(() => {
    const latest = latestRef
    const lastWritten = lastWrittenRef
    return () => {
      const { selections: pending, serverSelections: server, serverJson: currentServerJson, dirty: isDirty, onFlowStateChange: write } = latest.current
      if (!isDirty) {
        return
      }
      const normalized = normalizeForWrite(pending, server)
      const json = canonicalSelectionsJson(normalized)
      if (json !== lastWritten.current && json !== currentServerJson) {
        write({ tradeSelections: normalized })
      }
    }
  }, [])

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

  const removeTrade = useCallback((tradeId: string) => {
    setDirty(true)
    setSelections(current => withoutTrade(current, tradeId))
  }, [])

  const restoreTrade = useCallback((entry: TradeSelection) => {
    setDirty(true)
    setSelections(current => withTradeRestored(current, entry))
  }, [])

  const [urlTradeId, setUrlTradeId] = useQueryState('trade', tradeStageParser)
  const [stageMediaKey, setStageMediaKey] = useState<string | null>(null)
  // A string: the memoized stage value below keeps its identity across toggles unless the resolved trade changes.
  const stageTradeId = resolveStageTradeId(urlTradeId, selections, catalog)

  const showTrade = useCallback((tradeId: string | null) => {
    setStageMediaKey(null)
    void setUrlTradeId(tradeId)
  }, [setUrlTradeId])

  const showMedia = useCallback((key: string | null) => {
    setStageMediaKey(key)
  }, [])

  const catalogValue = useMemo<TradeCatalogContextValue>(() => ({ catalog, projects }), [catalog, projects])

  const actionsValue = useMemo<TradeActions>(
    () => ({ toggleItem, toggleReason, setNote, removeTrade, restoreTrade }),
    [toggleItem, toggleReason, setNote, removeTrade, restoreTrade],
  )

  const stageValue = useMemo<TradeStageState>(
    () => ({ stageTradeId, stageMediaKey, showTrade, showMedia }),
    [stageTradeId, stageMediaKey, showTrade, showMedia],
  )

  return (
    <TradeCatalogContext value={catalogValue}>
      <TradeActionsContext value={actionsValue}>
        <TradeSelectionsContext value={selections}>
          <TradeStageContext value={stageValue}>
            {children}
          </TradeStageContext>
        </TradeSelectionsContext>
      </TradeActionsContext>
    </TradeCatalogContext>
  )
}
