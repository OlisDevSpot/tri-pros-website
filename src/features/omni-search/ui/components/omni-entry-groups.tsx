'use client'

import type { OmniEntry, RankedOmniEntry } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ENTRY_CAPS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'

interface Props {
  ranked: RankedOmniEntry[]
  onSelect: (entry: OmniEntry) => void
}

export function OmniEntryGroups({ ranked, onSelect }: Props) {
  const groups = [
    { key: 'go-to' as const, heading: OMNI_COPY.goTo, entries: ranked.filter(r => r.entry.group === 'go-to') },
    { key: 'actions' as const, heading: OMNI_COPY.actions, entries: ranked.filter(r => r.entry.group === 'actions') },
  ]
  return groups.map(group => group.entries.length > 0 && (
    <CommandGroup key={group.key} heading={group.heading}>
      {group.entries.slice(0, OMNI_ENTRY_CAPS[group.key]).map(({ entry }) => (
        <CommandItem key={entry.id} aria-label={omniRowLabel(entry.label, entry.parent)} value={entry.id} onSelect={() => onSelect(entry)} className={OMNI_ROW_CLASSES.compact}>
          <entry.icon aria-hidden className="text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{entry.label}</span>
          {entry.parent && <span className="shrink-0 text-xs text-muted-foreground">{entry.parent}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  ))
}
