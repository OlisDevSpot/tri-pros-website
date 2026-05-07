'use client'

import { EyeIcon, ShieldIcon } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Badge } from '@/shared/components/ui/badge'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

function useToggle() {
  const viewMode = useViewMode()
  const [, setView] = useQueryState('view')
  const isAgent = viewMode === 'agent'

  function toggle() {
    setView(isAgent ? null : 'agent')
  }

  return { isAgent, toggle }
}

/**
 * Desktop: sticky pill below the navbar at top-right.
 * Shows full label "Homeowner" / "Agent".
 */
export function ViewModeToggleDesktop() {
  const ability = useAbility()
  const { isAgent, toggle } = useToggle()

  if (!ability.can('update', 'Proposal')) {
    return null
  }

  return (
    <div className="fixed top-16 right-4 z-40">
      <Badge
        variant={isAgent ? 'destructive' : 'default'}
        role="button"
        tabIndex={0}
        aria-pressed={isAgent}
        aria-label={isAgent ? 'Switch to homeowner view' : 'Switch to agent view'}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={cn(
          'cursor-pointer text-xs font-semibold uppercase tracking-widest select-none px-3 py-1.5',
          'shadow-lg transition-colors',
        )}
      >
        {isAgent ? 'Agent' : 'Homeowner'}
      </Badge>
    </div>
  )
}

/**
 * Mobile: icon-only button that sits in the navbar next to the
 * section dropdown. Blue eye for homeowner, red shield for agent.
 */
export function ViewModeToggleMobile() {
  const ability = useAbility()
  const { isAgent, toggle } = useToggle()

  if (!ability.can('update', 'Proposal')) {
    return null
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isAgent}
      aria-label={isAgent ? 'Switch to homeowner view' : 'Switch to agent view'}
      className={cn(
        'flex items-center justify-center size-10 rounded-lg shrink-0 transition-colors',
        isAgent
          ? 'bg-destructive/20 text-destructive'
          : 'bg-primary/20 text-primary',
      )}
    >
      {isAgent ? <ShieldIcon className="size-5" /> : <EyeIcon className="size-5" />}
    </button>
  )
}

/**
 * Sticky desktop pill — renders only after hydration. The toggle is
 * position:fixed so it doesn't affect layout; deferring to after mount
 * avoids hydration mismatch from the server not having CASL session
 * context (server renders null, client renders the badge).
 */
export function ViewModeToggle() {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || isMobile) {
    return null
  }

  return <ViewModeToggleDesktop />
}
