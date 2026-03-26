'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TRADE_CATEGORY_LABELS,
  TRADE_CATEGORY_ORDER,
} from '@/features/meetings/constants/trade-categories'
import { TradeCard } from '@/features/meetings/ui/components/steps/trade-card'
import { TradeDetail } from '@/features/meetings/ui/components/steps/trade-detail'
import { Accordion } from '@/shared/components/ui/accordion'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'

interface SpecialtiesStepProps {
  flowContext: MeetingFlowContext
}

const SAVE_DEBOUNCE_MS = 800

export function SpecialtiesStep({ flowContext }: SpecialtiesStepProps) {
  const tradesQuery = useGetAllTrades()
  const allTrades = tradesQuery.data ?? []

  // ── Local state — edits happen here instantly, server sync is debounced ──
  const serverSelections = flowContext.flowState?.tradeSelections ?? []
  const [localSelections, setLocalSelections] = useState<TradeSelection[]>(serverSelections)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to always have latest local selections without re-creating callbacks
  const localSelectionsRef = useRef(localSelections)
  localSelectionsRef.current = localSelections

  const serverJson = JSON.stringify(serverSelections)
  useEffect(() => {
    setLocalSelections(serverSelections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJson])

  // Stable ref to onFlowStateChange so saveToServer doesn't change identity
  const onFlowStateChangeRef = useRef(flowContext.onFlowStateChange)
  onFlowStateChangeRef.current = flowContext.onFlowStateChange

  const saveToServer = useCallback((next: TradeSelection[]) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      onFlowStateChangeRef.current({ tradeSelections: next })
    }, SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // ── Group trades by category, sorted alphabetically within each ──
  const groupedTrades = useMemo(() => {
    const groups = new Map<string, Trade[]>()
    for (const category of TRADE_CATEGORY_ORDER) {
      groups.set(category, [])
    }
    groups.set('Other', [])

    for (const trade of allTrades) {
      const category = trade.type ?? 'Other'
      const bucket = groups.get(category)
      if (bucket) {
        bucket.push(trade)
      }
      else {
        groups.get('Other')!.push(trade)
      }
    }

    for (const bucket of groups.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name))
    }

    return Array.from(groups.entries()).filter(([, trades]) => trades.length > 0)
  }, [allTrades])

  const selectedTradeIds = useMemo(
    () => new Set(localSelections.map(s => s.tradeId)),
    [localSelections],
  )

  // Stable callback — uses ref to avoid re-creating on every selection change
  const handleTradeToggle = useCallback((trade: Trade) => {
    const current = localSelectionsRef.current
    const isSelected = current.some(s => s.tradeId === trade.id)
    let next: TradeSelection[]

    if (isSelected) {
      next = current.filter(s => s.tradeId !== trade.id)
    }
    else {
      next = [...current, {
        tradeId: trade.id,
        tradeName: trade.name,
        selectedScopes: [],
        painPoints: [],
      }]
    }

    setLocalSelections(next)
    saveToServer(next)
  }, [saveToServer])

  const handleSelectionChange = useCallback((updated: TradeSelection) => {
    const current = localSelectionsRef.current
    const next = current.map(s =>
      s.tradeId === updated.tradeId ? updated : s,
    )
    setLocalSelections(next)
    saveToServer(next)
  }, [saveToServer])

  if (tradesQuery.isLoading) {
    return <LoadingState title="Loading trades" description="Fetching available specialties..." />
  }

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold">What areas of your home matter most?</h2>
        <p className="text-sm text-muted-foreground">
          Select every specialty that applies. We&apos;ll dig into specifics for each one.
        </p>
      </div>

      {/* Trade categories — horizontal scrollable per category */}
      {groupedTrades.map(([category, trades]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {TRADE_CATEGORY_LABELS[category as keyof typeof TRADE_CATEGORY_LABELS] ?? category}
          </h3>
          <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
            {trades.map(trade => (
              <div key={trade.id} className="w-40 shrink-0">
                <TradeCard
                  trade={trade}
                  isSelected={selectedTradeIds.has(trade.id)}
                  onToggle={handleTradeToggle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Selected trade details — collapsible accordion, defaults closed */}
      {localSelections.length > 0
        ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Tell us more about each specialty</h3>
                <p className="text-xs text-muted-foreground">
                  For each selected trade, check off pain points and specific work you&apos;re interested in.
                </p>
              </div>

              <Accordion type="multiple" className="space-y-3">
                {localSelections.map((selection, index) => (
                  <TradeDetail
                    key={selection.tradeId}
                    selection={selection}
                    index={index}
                    onChange={handleSelectionChange}
                  />
                ))}
              </Accordion>
            </div>
          )
        : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 px-6 py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">No specialties selected yet</p>
              <p className="text-xs text-muted-foreground/70">
                Select a trade above to start building your project scope.
              </p>
            </div>
          )}
    </div>
  )
}
