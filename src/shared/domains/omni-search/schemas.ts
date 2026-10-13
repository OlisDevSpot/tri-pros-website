import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'

import z from 'zod'

import { PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'

export const OMNI_TERM_MIN = 2
export const OMNI_TERM_MAX = 80
export const OMNI_LIMITS = { customers: 5, relatedCustomers: 3, related: 5 } as const

/** The term the server sees: trimmed, whitespace collapsed, clamped. `null` when too short to search. */
export function toOmniTerm(raw: string): string | null {
  const term = raw.trim().replace(/\s+/g, ' ').slice(0, OMNI_TERM_MAX).trim()
  return term.length >= OMNI_TERM_MIN ? term : null
}

export const omniSearchInputSchema = z.object({
  term: z.string().trim().min(OMNI_TERM_MIN).max(OMNI_TERM_MAX),
})
export type OmniSearchInput = z.infer<typeof omniSearchInputSchema>

const profileTabs = Object.keys(PROFILE_TAB_LABELS) as [CustomerProfileTab, ...CustomerProfileTab[]]

export const omniTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('profile'),
    customerId: z.string(),
    defaultTab: z.enum(profileTabs).optional(),
    highlightMeetingId: z.string().optional(),
  }),
  z.object({ kind: z.literal('route'), href: z.string().regex(/^\/(?!\/)/) }),
])
export type OmniTarget = z.infer<typeof omniTargetSchema>
