'use client'

import { useQueryState } from 'nuqs'

import { useAbility } from '@/shared/domains/permissions/hooks'

export type ViewMode = 'customer' | 'agent'

/**
 * Single source of truth for the proposal-flow view mode. Reads `?view`
 * and applies the CASL permission gate inside the hook so no caller can
 * accidentally bypass it: a homeowner who appends `?view=agent` to the
 * URL deterministically gets `'customer'`.
 *
 * Default (no `?view` param) is `'customer'` — agents must opt in,
 * which keeps internal data hidden by default.
 */
export function useViewMode(): ViewMode {
  const [view] = useQueryState('view')
  const ability = useAbility()
  if (view === 'agent' && ability.can('update', 'Proposal')) {
    return 'agent'
  }
  return 'customer'
}
