'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TradeCard } from '@/features/meetings/ui/components/steps/trade-card'
import { TradeDetail } from '@/features/meetings/ui/components/steps/trade-detail'
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

  // Sync from server → local only when server data actually changes (e.g. on initial load)
  const serverJson = JSON.stringify(serverSelections)
  useEffect(() => {
    setLocalSelections(serverSelections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJson])

  const saveToServer = useCallback((next: TradeSelection[]) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      flowContext.onFlowStateChange({ tradeSelections: next })
    }, SAVE_DEBOUNCE_MS)
  }, [flowContext])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const selectedTradeIds = new Set(localSelections.map(s => s.tradeId))

  function handleTradeToggle(trade: Trade) {
    let next: TradeSelection[]
    if (selectedTradeIds.has(trade.id)) {
      next = localSelections.filter(s => s.tradeId !== trade.id)
    }
    else {
      const newEntry: TradeSelection = {
        tradeId: trade.id,
        tradeName: trade.name,
        selectedScopes: [],
        painPoints: [],
      }
      next = [...localSelections, newEntry]
    }
    setLocalSelections(next)
    saveToServer(next)
  }

  function handleSelectionChange(updated: TradeSelection) {
    const next = localSelections.map(s =>
      s.tradeId === updated.tradeId ? updated : s,
    )
    setLocalSelections(next)
    saveToServer(next)
  }

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

      {/* Trade selection grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {allTrades.map(trade => (
          <TradeCard
            key={trade.id}
            trade={trade}
            isSelected={selectedTradeIds.has(trade.id)}
            onToggle={handleTradeToggle}
          />
        ))}
      </div>

      {/* Selected trade details */}
      {localSelections.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Tell us more about each specialty</h3>
            <p className="text-xs text-muted-foreground">
              For each selected trade, check off pain points and specific work you&apos;re interested in.
            </p>
          </div>

          <div className="space-y-3">
            {localSelections.map(selection => (
              <TradeDetail
                key={selection.tradeId}
                selection={selection}
                onChange={handleSelectionChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
