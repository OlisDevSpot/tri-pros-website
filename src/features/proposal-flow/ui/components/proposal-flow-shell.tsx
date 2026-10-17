'use client'

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function ProposalFlowShell({ children }: Props) {
  return (
    <div
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
      } as React.CSSProperties}
      className="relative flex h-full flex-col overflow-hidden bg-background text-foreground"
      data-no-gutter-stable
    >
      {children}
    </div>
  )
}
