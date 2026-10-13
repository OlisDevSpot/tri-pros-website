'use client'

import type { OmniEntry, RankedOmniEntry } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ENTRY_CAP } from '@/features/omni-search/constants/omni-search'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'

interface Props {
  ranked: RankedOmniEntry[]
  onSelect: (entry: OmniEntry) => void
}

export function OmniEntryGroups({ ranked, onSelect }: Props) {
  const groups = [
    { heading: OMNI_COPY.goTo, entries: ranked.filter(r => r.entry.group === 'go-to') },
    { heading: OMNI_COPY.actions, entries: ranked.filter(r => r.entry.group === 'actions') },
  ]
  return groups.map(group => group.entries.length > 0 && (
    <CommandGroup key={group.heading} heading={group.heading}>
      {group.entries.slice(0, OMNI_ENTRY_CAP).map(({ entry }) => (
        <CommandItem key={entry.id} value={entry.id} onSelect={() => onSelect(entry)}>
          <entry.icon aria-hidden className="text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{entry.label}</span>
          {entry.parent && <span className="shrink-0 text-xs text-muted-foreground">{entry.parent}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  ))
}
