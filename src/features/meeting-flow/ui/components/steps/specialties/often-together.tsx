'use client'

import type { Trade } from '@/shared/modules/construction/sources/notion/trades/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'

interface OftenTogetherProps {
  trade: Trade
}

/** Homeowner-safe pairing prompt: names the pair, never the internal reason (that lives in the panel). Shown when this trade is on the project and its pair is not. */
export function OftenTogether({ trade }: OftenTogetherProps) {
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showTrade } = useTradeStage()
  const pairing = TRADE_PAIRINGS[trade.slug]
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined

  if (!paired || !isTradeSelected(selections, trade.id) || isTradeSelected(selections, paired.id)) {
    return null
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card p-2">
      <TradeThumb className="size-11" trade={paired} />
      <p className="flex flex-col">
        <span className="text-sm font-semibold">{SPECIALTIES_COPY.work.together}</span>
        <span className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.work.togetherPair(trade.name, paired.name)}</span>
      </p>
      <Button className="h-11" variant="outline" onClick={() => showTrade(paired.id)}>
        {SPECIALTIES_COPY.work.show(paired.name)}
      </Button>
    </div>
  )
}
