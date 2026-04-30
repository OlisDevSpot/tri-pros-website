'use client'

import type { PaginatedQueryResult } from '@/shared/dal/client/query/types'

import { createContext, use } from 'react'

/**
 * Context that the `<QueryToolbar>` root provides to all slot children. Each
 * slot reads the pagination state it needs (filters, search, sort, page-size)
 * and dispatches via the corresponding setters.
 */
const QueryToolbarContext = createContext<PaginatedQueryResult<unknown> | null>(null)

export const QueryToolbarProvider = QueryToolbarContext.Provider

/**
 * Hook for `<QueryToolbar>` slot children. Throws if used outside a
 * `<QueryToolbar>` root, which signals a misuse of the compound API.
 *
 * Generic parameter is unused — slots don't need TRow because they only
 * touch state, not data rows. Cast at the boundary.
 */
export function useQueryToolbarContext(): PaginatedQueryResult<unknown> {
  const ctx = use(QueryToolbarContext)
  if (!ctx) {
    throw new Error('QueryToolbar slot used outside of <QueryToolbar> root')
  }
  return ctx
}
