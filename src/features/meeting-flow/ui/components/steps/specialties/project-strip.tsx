'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

/** Selected trades as pressed chips. A chip opens that trade's sheet. Reads the model; never edits it. */
export function ProjectStrip() {
  const { selections } = useTradeSelection()
  const { openTrade } = useTradeSheet()
  const selected = selectedTradeSelections(selections)

  return (
    <section aria-labelledby="project-strip-heading" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
      <h3 id="project-strip-heading" className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.project.eyebrow}
      </h3>
      {selected.length === 0
        ? <p className="text-base text-muted-foreground">{SPECIALTIES_COPY.project.empty}</p>
        : selected.map(selection => (
            <Button
              key={selection.tradeId}
              aria-pressed
              className="h-11 gap-2 aria-pressed:border-primary aria-pressed:bg-primary/5 dark:aria-pressed:border-primary"
              size="sm"
              variant="outline"
              onClick={() => openTrade(selection.tradeId)}
            >
              {selection.tradeName}
              <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
                {itemCount(selection)}
              </span>
            </Button>
          ))}
    </section>
  )
}
