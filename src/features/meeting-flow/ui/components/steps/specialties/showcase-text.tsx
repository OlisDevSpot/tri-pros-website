'use client'

import type { Trade } from '@/shared/modules/construction/core/schemas'
import { CheckIcon } from 'lucide-react'
import { SHOWCASE_BENEFIT_LIMIT } from '@/features/meeting-flow/constants/showcase'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { selectTradeBenefits } from '@/features/meeting-flow/lib/select-trade-benefits'
import { findTradeSelection, itemCount } from '@/features/meeting-flow/lib/trade-selection'

interface ShowcaseTextProps {
  trade: Trade
  titleId: string
}

/**
 * Eyebrow, title, outcome (the lead), status, benefits. In the band layout it overlays the photo's scrim;
 * at two columns it sits under the photo and clears the floating capsule. Title 30/36px Syne 600, outcome 17/20px.
 */
export function ShowcaseText({ trade, titleId }: ShowcaseTextProps) {
  const selections = useTradeSelections()
  const count = itemCount(findTradeSelection(selections, trade.id))
  const outcome = TRADE_OUTCOMES[trade.slug]
  const benefits = selectTradeBenefits(trade.name, SHOWCASE_BENEFIT_LIMIT)
  const category = trade.category ? TRADE_CATEGORY_LABELS[trade.category] : undefined

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-6 @4xl/specialties:static @4xl/specialties:px-10 @4xl/specialties:pt-6 @4xl/specialties:pb-(--stage-inset-b)">
      {category && <p className="font-sans text-xs font-semibold tracking-[0.06em] text-white/80 uppercase">{category}</p>}
      <h2 className="font-sans text-3xl leading-[1.1] font-semibold tracking-[-0.01em] text-balance @4xl/specialties:text-4xl" id={titleId}>
        {trade.name}
      </h2>
      {outcome && (
        <p className="line-clamp-3 max-w-[48ch] text-[17px] leading-normal text-pretty text-white @4xl/specialties:line-clamp-none @4xl/specialties:max-w-[44ch] @4xl/specialties:text-xl">
          {outcome}
        </p>
      )}
      {count > 0 && (
        <p className="flex items-center gap-2 text-sm font-semibold text-(--presentation-accent)">
          <CheckIcon aria-hidden className="size-4" />
          {`${SPECIALTIES_COPY.showcase.status} · ${formatCount(count, SPECIALTIES_COPY.units.work)}`}
        </p>
      )}
      {benefits.length > 0 && (
        <ul className="mt-2 hidden grid-cols-2 gap-x-8 gap-y-4 @4xl/specialties:grid">
          {benefits.map(benefit => (
            <li key={benefit.headline} className="flex flex-col gap-0.5 border-t border-white/15 pt-3">
              <span className="text-base font-semibold text-white">{benefit.headline}</span>
              <span className="text-[15px] leading-normal text-white/75">{benefit.body}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
