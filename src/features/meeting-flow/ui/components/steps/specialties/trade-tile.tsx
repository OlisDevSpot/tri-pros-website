'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { ChevronRightIcon } from 'lucide-react'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { formatTradeMeta } from '@/features/meeting-flow/lib/format-trade-meta'
import { findTradeSelection, itemCount } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeTileProps {
  trade: Trade
}

/** Opens the trade's sheet. Pressed when the trade has one or more items. Never toggles selection itself. */
export function TradeTile({ trade }: TradeTileProps) {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { showTrade } = useTradeStage()
  const count = itemCount(findTradeSelection(selections, trade.id))

  return (
    <Button
      aria-pressed={count > 0}
      className="h-auto min-h-14 w-full justify-between gap-3 px-3.5 py-3 text-left whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 dark:aria-pressed:border-primary"
      variant="outline"
      onClick={() => showTrade(trade.id)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base leading-tight font-semibold">{trade.name}</span>
        <span className="text-sm text-muted-foreground">{formatTradeMeta(catalog.scopesByTrade.get(trade.id))}</span>
      </span>
      {count > 0
        ? (
            <span className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
              {count}
            </span>
          )
        : <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
    </Button>
  )
}
