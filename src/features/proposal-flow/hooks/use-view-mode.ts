'use client'

import { useQueryState } from 'nuqs'

import { useAbility } from '@/shared/domains/permissions/hooks'

export type ViewMode = 'customer' | 'agent'

/**
 * Customer-vs-agent view mode for the proposal flow. CASL-gated inside the hook.
 * see ../DOCS.md#view-mode-defaults-to-customer-casl-gates-agent
 */
export function useViewMode(): ViewMode {
  const [view] = useQueryState('view')
  const ability = useAbility()
  if (view === 'agent' && ability.can('update', 'Proposal')) {
    return 'agent'
  }
  return 'customer'
}
