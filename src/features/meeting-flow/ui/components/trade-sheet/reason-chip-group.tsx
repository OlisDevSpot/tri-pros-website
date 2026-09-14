'use client'

import { CheckIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { meetingPainTypes } from '@/shared/constants/enums'

interface ReasonChipGroupProps {
  tradeId: string
  selectedReasons: string[]
}

/** The eleven `meetingPainTypes`, per trade, written to that trade's `painPoints`. */
export function ReasonChipGroup({ tradeId, selectedReasons }: ReasonChipGroupProps) {
  const { toggleReason } = useTradeSelection()

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedReasons, next)
    for (const reason of [...added, ...removed]) {
      toggleReason(tradeId, reason)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 id={`reasons-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.reasons}
      </h3>
      <ToggleGroup aria-labelledby={`reasons-${tradeId}`} className="flex w-full flex-wrap gap-2" type="multiple" value={selectedReasons} onValueChange={handleValueChange}>
        {meetingPainTypes.map(reason => (
          <ToggleGroupItem
            key={reason}
            className="group h-auto min-h-11 flex-none rounded-full border border-border/70 px-3.5 py-2 text-base whitespace-normal transition-none first:rounded-full last:rounded-full data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            value={reason}
          >
            <CheckIcon aria-hidden className="hidden size-4 shrink-0 group-data-[state=on]:block" />
            {reason}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}
