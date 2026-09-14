'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { filterTradesByQuery } from '@/features/meeting-flow/lib/filter-trades-by-query'
import { groupTradesByCategory } from '@/features/meeting-flow/lib/group-trades-by-category'
import { TradeTile } from '@/features/meeting-flow/ui/components/steps/specialties/trade-tile'
import { Input } from '@/shared/components/ui/input'

interface TradeCatalogProps {
  hasLead: boolean
}

/** Every trade, in three category grids that wrap. No horizontal scrolling. */
export function TradeCatalog({ hasLead }: TradeCatalogProps) {
  const { catalog } = useTradeSelection()
  const [query, setQuery] = useState('')
  const groups = useMemo(
    () => groupTradesByCategory(filterTradesByQuery(catalog.trades, query)),
    [catalog.trades, query],
  )

  return (
    <section aria-labelledby="trade-catalog-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="trade-catalog-heading" className="text-base font-semibold">
            {hasLead ? SPECIALTIES_COPY.catalog.headingWithLead : SPECIALTIES_COPY.catalog.headingNoLead}
          </h3>
          <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.catalog.hint}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={SPECIALTIES_COPY.catalog.searchLabel}
            autoComplete="off"
            className="h-11 pl-8 text-base"
            placeholder={SPECIALTIES_COPY.catalog.searchPlaceholder}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
      </div>

      {groups.length === 0 && <p className="text-base text-muted-foreground">{SPECIALTIES_COPY.catalog.noMatches}</p>}

      {groups.map(([category, trades]) => (
        <div key={category} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {TRADE_CATEGORY_LABELS[category as TradeCategory] ?? category}
          </h4>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map(trade => (
              <li key={trade.id}>
                <TradeTile trade={trade} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
