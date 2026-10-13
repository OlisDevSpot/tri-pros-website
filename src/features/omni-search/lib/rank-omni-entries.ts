import type { OmniEntry, RankedOmniEntry } from '@/features/omni-search/types'

import { defaultFilter } from 'cmdk'

export function rankOmniEntries(entries: OmniEntry[], search: string): RankedOmniEntry[] {
  const term = search.trim()
  if (!term) {
    return entries.filter(entry => entry.featured).map(entry => ({ entry, score: 0 }))
  }
  return entries
    .map(entry => ({ entry, score: defaultFilter(entry.label, term, [...entry.aliases, ...(entry.parent ? [entry.parent] : [])]) }))
    .filter(ranked => ranked.score > 0)
    .sort((a, b) => b.score - a.score)
}
