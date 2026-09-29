'use client'

import { useMemo } from 'react'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { useToolbarInternal } from '@/shared/components/query-toolbar/lib/internal-context'
import { formatTotalCount } from '@/shared/lib/pagination-format'

export function QueryToolbarLiveStatus() {
  const { total, isLoading, isFetching } = useQueryToolbarContext()
  const { entityName } = useToolbarInternal()

  const message = useMemo(() => {
    if (isLoading) {
      return `Loading ${entityName}…`
    }
    if (isFetching) {
      return `Updating ${entityName}…`
    }
    if (total === 0) {
      return `No ${entityName} match the current filters.`
    }
    return `Showing ${formatTotalCount(total)} ${entityName}.`
  }, [total, isLoading, isFetching, entityName])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
