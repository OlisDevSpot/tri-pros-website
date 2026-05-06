'use client'

import type { ReactNode } from 'react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'

interface Props {
  children: ReactNode
}

/**
 * Client wrapper for the proposal-flow layout. Owns the page background
 * gradient and a `data-view-mode` attribute. The gradient accent swaps
 * from primary (blue) to destructive (red) when the agent is in agent
 * mode — peripheral-vision tell that internal data is exposed.
 *
 * Lives here (not in `layout.tsx`) because the layout is a server
 * component and the gradient depends on a client-side URL param.
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
      {children}
    </div>
  )
}
