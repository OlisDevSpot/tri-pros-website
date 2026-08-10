import type { ReactElement, ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface DashboardModuleProps {
  title: string
  /** Optional right-aligned header slot — the module's `See all →` link/button. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Shared card chrome for dashboard modules (Meetings / Proposals / Projects):
 * a single-sourced Command Desk elevation with a title + optional right-aligned
 * action in the header row. Section anchors (`#meetings`, `#proposals`,
 * `#projects`) are owned by the `<section>` wrappers in `DashboardView`, not
 * by this component.
 */
export function DashboardModule({ title, action, className, children }: DashboardModuleProps): ReactElement {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 shadow-sm shadow-primary/5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}
