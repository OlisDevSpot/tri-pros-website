'use client'

import { useMemo } from 'react'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { useToolbarInternal } from '@/shared/components/query-toolbar/lib/internal-context'
import { formatTotalCount } from '@/shared/lib/pagination-format'

export function QueryToolbarLiveStatus() {
  const { query } = useQueryToolbarContext()
  const { total, isPending, isStale, isFetching } = query
  const { entityName } = useToolbarInternal()

  const message = useMemo(() => {
    if (isPending) {
      return `Loading ${entityName}…`
    }
    if (isStale || isFetching) {
      return `Updating ${entityName}…`
    }
    if (total === 0) {
      return `No ${entityName} match the current filters.`
    }
    return `Showing ${formatTotalCount(total)} ${entityName}.`
  }, [total, isPending, isStale, isFetching, entityName])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
