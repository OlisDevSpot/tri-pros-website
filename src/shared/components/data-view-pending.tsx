'use client'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

/** Renders a data view as its own loading state: the real view, with its cached rows or none. */
export function DataViewPending({ children }: { children: React.ReactNode }) {
  return (
    <DataViewPendingContext value="loading">
      <div className="contents" data-slot="data-view-pending">{children}</div>
    </DataViewPendingContext>
  )
}
