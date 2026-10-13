import type { RecentOmniItem } from '@/features/omni-search/types'

import z from 'zod'

import { omniTargetSchema } from '@/shared/domains/omni-search/schemas'

// Per user: a shared device would otherwise show the previous person's customers.
const storageKey = (userId: string) => `omni-search.recent:${userId}`
const MAX_RECENT = 5

const recentSchema = z.array(z.object({
  key: z.string(),
  kind: z.enum(['customer', 'meeting', 'proposal', 'project']),
  label: z.string(),
  sublabel: z.string().optional(),
  target: omniTargetSchema,
})).catch([])

// Storage can be missing or throw (private window, blocked site data); losing the list costs nothing.
export function readRecentOmniItems(userId: string): RecentOmniItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? recentSchema.parse(JSON.parse(raw)).slice(0, MAX_RECENT) : []
  }
  catch {
    return []
  }
}

export function pushRecentOmniItem(userId: string, item: RecentOmniItem): void {
  try {
    const next = [item, ...readRecentOmniItems(userId).filter(existing => existing.key !== item.key)].slice(0, MAX_RECENT)
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
  }
  catch {}
}
