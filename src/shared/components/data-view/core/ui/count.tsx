'use client'

import { use } from 'react'

import { useDataView } from '@/shared/components/data-view/core/lib/context'
import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { formatTotalCount } from '@/shared/lib/pagination-format'

export function DataViewCount({ className }: { className?: string }) {
  const { query } = useDataView()
  // The error fallback has no rows and no total; "Loading…" under a retry would say the opposite of the retry.
  if (use(DataViewPendingContext) === 'error') {
    return null
  }
  return (
    <span data-slot="data-view-count" className={className}>
      {query.isPending ? 'Loading…' : formatTotalCount(query.total)}
    </span>
  )
}
