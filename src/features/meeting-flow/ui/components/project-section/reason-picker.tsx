'use client'

import { CheckIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { meetingPainTypes } from '@/shared/constants/enums'

interface ReasonPickerProps {
  tradeId: string
  reasons: string[]
}

/** Selected reasons first; "Edit reasons" reveals all eleven. Rep-only (spec D9). */
export function ReasonPicker({ tradeId, reasons }: ReasonPickerProps) {
  const { toggleReason } = useTradeActions()
  const [editing, setEditing] = useState(false)
  const labelId = useId()
  const visible = editing ? meetingPainTypes : meetingPainTypes.filter(reason => reasons.includes(reason))

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(reasons, next)
    for (const reason of [...added, ...removed]) {
      toggleReason(tradeId, reason)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" id={labelId}>{SPECIALTIES_COPY.panel.reasons}</p>
        <Button aria-expanded={editing} className="h-11 px-2 font-semibold" variant="ghost" onClick={() => setEditing(value => !value)}>
          {editing ? SPECIALTIES_COPY.panel.doneEditing : SPECIALTIES_COPY.panel.editReasons}
        </Button>
      </div>
      {visible.length === 0
        ? <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.noReason}</p>
        : (
            <ToggleGroup aria-labelledby={labelId} className="flex w-full flex-wrap gap-2" type="multiple" value={reasons} onValueChange={handleValueChange}>
              {visible.map(reason => (
                <ToggleGroupItem
                  key={reason}
                  className="group h-auto min-h-11 flex-none gap-1.5 rounded-[3px] border border-border px-3 py-2 text-sm font-normal whitespace-normal motion-safe:transition-colors motion-safe:duration-200 first:rounded-[3px] last:rounded-[3px] data-[state=on]:border-primary data-[state=on]:bg-primary/8 data-[state=on]:text-foreground"
                  value={reason}
                >
                  <CheckIcon aria-hidden className="hidden size-3.5 text-primary group-data-[state=on]:block" />
                  {reason}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
    </div>
  )
}
