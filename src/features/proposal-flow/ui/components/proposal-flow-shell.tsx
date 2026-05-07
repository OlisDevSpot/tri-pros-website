'use client'

import type { ReactNode } from 'react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { ViewModeToggle } from '@/features/proposal-flow/ui/components/proposal/view-mode-toggle'

interface Props {
  children: ReactNode
}

/**
 * Client wrapper for the proposal-flow layout. Owns the page background
 * gradient, `data-view-mode` attribute, and the sticky desktop view-mode
 * toggle. The gradient accent swaps from primary (blue) to destructive
 * (red) when the agent is in agent mode.
 */
export function ProposalFlowShell({ children }: Props) {
  const viewMode = useViewMode()
  const accent = viewMode === 'agent' ? 'var(--destructive)' : 'var(--primary)'

  return (
    <div
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
        'background': `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, ${accent} 60%, transparent))`,
      } as React.CSSProperties}
      className="h-full flex flex-col"
      data-no-gutter-stable
      data-view-mode={viewMode}
    >
      <ViewModeToggle />
      {children}
    </div>
  )
}
