'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'

/** Trades already on the project, above the switcher (spec D7). Keeps its height when empty so nothing below jumps. */
export function OnProjectTrades() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId, showTrade } = useTradeStage()
  const onProject = selectedTradeSelections(selections)

  return (
    <div className="flex min-h-19 flex-col gap-2">
      <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{SPECIALTIES_COPY.work.onProject}</h3>
      {onProject.length === 0
        ? <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.work.onProjectEmpty}</p>
        : (
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
              {onProject.map(entry => (
                <li key={entry.tradeId} className="shrink-0">
                  <Button
                    aria-current={entry.tradeId === stageTradeId ? 'true' : undefined}
                    className="h-12 gap-2 pr-3 pl-1 aria-[current=true]:border-primary aria-[current=true]:outline-2 aria-[current=true]:outline-solid aria-[current=true]:-outline-offset-2 aria-[current=true]:outline-primary"
                    variant="outline"
                    onClick={() => showTrade(entry.tradeId)}
                  >
                    <TradeThumb trade={catalog.tradesById.get(entry.tradeId)} />
                    <span className="text-sm font-semibold">{entry.tradeName}</span>
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">{itemCount(entry)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}
