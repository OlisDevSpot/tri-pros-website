'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { XIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { Button } from '@/shared/components/ui/button'

interface OrphanItemChipsProps {
  entry: TradeSelection
  items: SelectionItem[]
  onBeforeRemove: () => void
}

/** Stored items the current catalog no longer lists for this trade. Shown by stored label, removable, never dropped silently. */
export function OrphanItemChips({ entry, items, onBeforeRemove }: OrphanItemChipsProps) {
  const { toggleWork } = useTradeEdits()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.orphanHint}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map(item => (
          <li key={item.id}>
            <Button aria-label={SPECIALTIES_COPY.panel.removeItem(item.label)} className="h-11 font-normal" variant="outline" onClick={() => toggleWork(entry.tradeId, entry, item, onBeforeRemove)}>
              {item.label}
              <XIcon aria-hidden className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
