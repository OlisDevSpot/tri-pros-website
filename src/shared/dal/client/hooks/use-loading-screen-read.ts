'use client'

import type { QueryKey } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'
import { use } from 'react'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

/**
 * What a read does in a pending view. A loading screen shows the key's cached rows and starts no fetch, because the
 * page that replaces it refreshes them. `null` means there is nothing to show (nothing cached, or an error fallback),
 * so the caller draws its skeleton. Outside a pending view the options pass through unchanged.
 */
export function useLoadingScreenRead<TOptions extends { queryKey: QueryKey }>(options: TOptions): TOptions | null {
  const state = use(DataViewPendingContext)
  const qc = useQueryClient()
  if (state === false) {
    return options
  }
  if (state === 'error' || qc.getQueryData(options.queryKey) === undefined) {
    return null
  }
  return { ...options, refetchOnMount: false }
}
