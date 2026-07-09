'use client'

import { useQueryState } from 'nuqs'

import { useViewMode } from './use-view-mode'

/**
 * Agent-side toggle between customer and agent view. Writes the nuqs
 * `view` param; useViewMode (CASL-gated) remains the single source of truth.
 * see ../DOCS.md#view-mode-defaults-to-customer-casl-gates-agent
 */
export function useViewModeToggle() {
  const viewMode = useViewMode()
  const [, setView] = useQueryState('view')
  const isAgent = viewMode === 'agent'

  function toggle() {
    setView(isAgent ? null : 'agent')
  }

  return { isAgent, toggle }
}
