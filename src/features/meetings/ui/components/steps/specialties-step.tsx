'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { TradeCard } from '@/features/meetings/ui/components/steps/trade-card'
import { TradeDetail } from '@/features/meetings/ui/components/steps/trade-detail'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'

interface SpecialtiesStepProps {
  flowContext: MeetingFlowContext
}

export function SpecialtiesStep({ flowContext }: SpecialtiesStepProps) {
  const tradesQuery = useGetAllTrades()
  const allTrades = tradesQuery.data ?? []

  const tradeSelections = flowContext.flowState?.tradeSelections ?? []
  const selectedTradeIds = new Set(tradeSelections.map(s => s.tradeId))

  function handleTradeToggle(trade: Trade) {
    if (selectedTradeIds.has(trade.id)) {
      const next = tradeSelections.filter(s => s.tradeId !== trade.id)
      flowContext.onFlowStateChange({ tradeSelections: next })
    }
    else {
      const newEntry: TradeSelection = {
        tradeId: trade.id,
        tradeName: trade.name,
        selectedScopes: [],
        painPoints: [],
      }
      flowContext.onFlowStateChange({ tradeSelections: [...tradeSelections, newEntry] })
    }
  }

  function handleSelectionChange(updated: TradeSelection) {
    const next = tradeSelections.map(s =>
      s.tradeId === updated.tradeId ? updated : s,
    )
    flowContext.onFlowStateChange({ tradeSelections: next })
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
          Select every specialty that applies. We'll dig into specifics for each one.
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
      {tradeSelections.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Tell us more about each specialty</h3>
            <p className="text-xs text-muted-foreground">
              For each selected trade, check off pain points and specific work you're interested in.
            </p>
          </div>

          <div className="space-y-3">
            {tradeSelections.map(selection => (
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
