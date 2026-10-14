'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_RECORD_ICONS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'

interface Props {
  items: RecentOmniItem[]
  onSelect: (item: RecentOmniItem) => void
}

export function OmniRecentGroup({ items, onSelect }: Props) {
  if (items.length === 0) {
    return null
  }
  return (
    <CommandGroup heading={OMNI_COPY.recent}>
      {items.map((item) => {
        const Icon = OMNI_RECORD_ICONS[item.kind]
        return (
          <CommandItem key={item.key} aria-label={omniRowLabel(item.label, item.sublabel)} value={`recent:${item.key}`} onSelect={() => onSelect(item)} className={OMNI_ROW_CLASSES.compact}>
            <Icon aria-hidden className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-foreground">{item.label}</span>
            {item.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>}
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
