import type { RecentOmniItem } from '@/features/omni-search/types'

import z from 'zod'

import { omniTargetSchema } from '@/shared/domains/omni-search/schemas'

const STORAGE_KEY = 'omni-search.recent'
const MAX_RECENT = 5

const recentSchema = z.array(z.object({
  key: z.string(),
  kind: z.enum(['customer', 'meeting', 'proposal', 'project']),
  label: z.string(),
  sublabel: z.string().optional(),
  target: omniTargetSchema,
})).catch([])

// Storage can be missing or throw (private window, blocked site data); losing the list costs nothing.
export function readRecentOmniItems(): RecentOmniItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? recentSchema.parse(JSON.parse(raw)).slice(0, MAX_RECENT) : []
  }
  catch {
    return []
  }
}

export function pushRecentOmniItem(item: RecentOmniItem): void {
  try {
    const next = [item, ...readRecentOmniItems().filter(existing => existing.key !== item.key)].slice(0, MAX_RECENT)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  catch {}
}
