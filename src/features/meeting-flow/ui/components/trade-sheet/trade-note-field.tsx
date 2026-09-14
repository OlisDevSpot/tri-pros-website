'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

interface TradeNoteFieldProps {
  tradeId: string
  tradeName: string
  note: string
}

export function TradeNoteField({ tradeId, tradeName, note }: TradeNoteFieldProps) {
  const { setNote } = useTradeSelection()
  const id = `trade-note-${tradeId}`

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor={id}>
        {SPECIALTIES_COPY.sheet.note}
      </Label>
      <Textarea
        id={id}
        className="min-h-20 resize-none text-base"
        placeholder={SPECIALTIES_COPY.sheet.notePlaceholder(tradeName)}
        rows={2}
        value={note}
        onChange={event => setNote(tradeId, event.target.value)}
      />
    </div>
  )
}
