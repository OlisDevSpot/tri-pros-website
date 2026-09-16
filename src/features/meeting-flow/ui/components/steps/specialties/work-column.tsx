'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useStageTrade } from '@/features/meeting-flow/hooks/use-stage-trade'
import { OftenTogether } from '@/features/meeting-flow/ui/components/steps/specialties/often-together'
import { OnProjectTrades } from '@/features/meeting-flow/ui/components/steps/specialties/on-project-trades'
import { TradeSwitcher } from '@/features/meeting-flow/ui/components/steps/specialties/trade-switcher'
import { WorkCardGroup } from '@/features/meeting-flow/ui/components/steps/specialties/work-card-group'

/** The rep's column: the question, trades on the project, then one group headed by the switcher (spec D7). Scrolls on its own and clears the capsule. */
export function WorkColumn() {
  const trade = useStageTrade()

  return (
    <section
      aria-label={SPECIALTIES_COPY.work.regionLabel}
      className="min-h-0 overflow-y-auto overscroll-contain border-t bg-muted/30 @4xl/specialties:border-t-0 @4xl/specialties:border-l"
    >
      <div className="flex flex-col gap-6 px-6 pt-5 pb-(--stage-inset-b) @4xl/specialties:pt-6">
        <h2 className="font-sans text-lg font-semibold text-balance @4xl/specialties:text-xl">{SPECIALTIES_COPY.heading}</h2>
        <OnProjectTrades />
        {trade && (
          <div className="flex flex-col gap-3">
            <TradeSwitcher trade={trade} />
            <WorkCardGroup trade={trade} />
            <OftenTogether trade={trade} />
          </div>
        )}
      </div>
    </section>
  )
}
