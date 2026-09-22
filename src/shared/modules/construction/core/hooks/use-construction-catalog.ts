'use client'

import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { buildCatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import { useTRPC } from '@/trpc/helpers'

export type ConstructionCatalog = CatalogIndex & {
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** The whole trade and scope catalog, fetched once and indexed once. No per-trade or hover-time queries. */
export function useConstructionCatalog(): ConstructionCatalog {
  const trpc = useTRPC()
  const tradesQuery = useQuery(trpc.constructionRouter.trades.getAll.queryOptions())
  const scopesQuery = useQuery(trpc.constructionRouter.scopes.getAll.queryOptions())

  const index = useMemo(
    () => buildCatalogIndex(tradesQuery.data ?? [], scopesQuery.data ?? []),
    [tradesQuery.data, scopesQuery.data],
  )

  const refetchTrades = tradesQuery.refetch
  const refetchScopes = scopesQuery.refetch
  const refetch = useCallback(() => {
    void refetchTrades()
    void refetchScopes()
  }, [refetchTrades, refetchScopes])

  const isLoading = tradesQuery.isLoading || scopesQuery.isLoading
  const error = (tradesQuery.error as Error | null) ?? (scopesQuery.error as Error | null) ?? null

  return useMemo(
    () => ({ ...index, isLoading, error, refetch }),
    [index, isLoading, error, refetch],
  )
}
