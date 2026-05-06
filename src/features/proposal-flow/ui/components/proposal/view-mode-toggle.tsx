'use client'

import { useQueryState } from 'nuqs'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Badge } from '@/shared/components/ui/badge'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

/**
 * Clickable Badge that flips between Customer and Agent view by writing
 * `?view=agent` to the URL. Only renders for agents; homeowners never
 * see the toggle. The CASL gate inside `useViewMode` is what actually
 * enforces visibility — this guard is a UX nicety to avoid showing a
 * non-functional control.
 */
export function ViewModeToggle() {
  const ability = useAbility()
  const viewMode = useViewMode()
  const [, setView] = useQueryState('view')

  if (!ability.can('update', 'Proposal')) {
    return null
  }

  const isAgent = viewMode === 'agent'

  return (
    <Badge
      variant={isAgent ? 'destructive' : 'secondary'}
      role="button"
      tabIndex={0}
      aria-pressed={isAgent}
      aria-label={isAgent ? 'Switch to customer view' : 'Switch to agent view'}
      onClick={() => setView(isAgent ? null : 'agent')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setView(isAgent ? null : 'agent')
        }
      }}
      className={cn(
        'cursor-pointer text-xs font-semibold uppercase tracking-widest select-none',
        'transition-colors',
      )}
    >
      {isAgent ? 'Agent' : 'Customer'}
    </Badge>
  )
}
