'use client'

import type { FetchQueryOptions } from '@tanstack/react-query'

import { hashKey, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

/**
 * Warms the cache for the reads a viewer reaches next (the page or date window either side of the current one),
 * so stepping there renders cached rows instead of an empty window. Waits for `ready`, which the caller holds false
 * while a read it needs first is running. Entries still inside `staleTime` are skipped by `prefetchQuery` itself.
 */
export function usePrefetchQueries(queries: readonly FetchQueryOptions<any, any, any, any>[], ready: boolean) {
  const qc = useQueryClient()
  const queriesKey = queries.map(query => hashKey(query.queryKey)).join('|')

  useEffect(() => {
    if (!ready) {
      return
    }
    for (const query of queries) {
      void qc.prefetchQuery(query)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the query keys' hashes, so option objects rebuilt each render don't re-run it
  }, [qc, ready, queriesKey])
}
