'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import { XIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { Button } from '@/shared/components/ui/button'

interface OrphanItemChipsProps {
  tradeId: string
  items: SelectionItem[]
}

/** Stored items the current catalog no longer lists for this trade. Shown by stored label, removable, never dropped silently. */
export function OrphanItemChips({ tradeId, items }: OrphanItemChipsProps) {
  const { toggleItem } = useTradeSelection()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.sheet.orphanHint}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map(item => (
          <li key={item.id}>
            <Button className="h-11" size="sm" variant="outline" onClick={() => toggleItem(tradeId, item)}>
              {item.label}
              <XIcon aria-hidden className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
