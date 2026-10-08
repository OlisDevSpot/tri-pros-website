'use client'

import type { ReactNode } from 'react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'

interface Props {
  children: ReactNode
}

export function ProposalFlowShell({ children }: Props) {
  const viewMode = useViewMode()

  return (
    <div
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
      } as React.CSSProperties}
      className="h-full flex flex-col bg-background"
      data-no-gutter-stable
      data-view-mode={viewMode}
    >
      {children}
    </div>
  )
}
