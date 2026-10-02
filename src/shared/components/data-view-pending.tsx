'use client'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

/** Renders a data view as its own loading state: the real view, with no rows. */
export function DataViewPending({ children }: { children: React.ReactNode }) {
  return (
    <DataViewPendingContext value={true}>
      <div className="contents" data-slot="data-view-pending">{children}</div>
    </DataViewPendingContext>
  )
}
