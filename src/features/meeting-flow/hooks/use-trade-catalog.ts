'use client'

import type { TradeCatalog } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { groupScopesByTrade } from '@/features/meeting-flow/lib/group-scopes-by-trade'
import { useTRPC } from '@/trpc/helpers'

/** The whole trade and scope catalog, fetched once and grouped once. No per-trade or hover-time queries. */
export function useTradeCatalog(): TradeCatalog {
  const trpc = useTRPC()
  const tradesQuery = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const scopesQuery = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const trades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data])
  const tradesById = useMemo(() => new Map(trades.map(trade => [trade.id, trade])), [trades])
  const tradesBySlug = useMemo(() => new Map(trades.map(trade => [trade.slug, trade])), [trades])
  const scopesByTrade = useMemo(() => groupScopesByTrade(scopesQuery.data ?? []), [scopesQuery.data])

  const refetchTrades = tradesQuery.refetch
  const refetchScopes = scopesQuery.refetch
  const refetch = useCallback(() => {
    void refetchTrades()
    void refetchScopes()
  }, [refetchTrades, refetchScopes])

  const isLoading = tradesQuery.isLoading || scopesQuery.isLoading
  const error = (tradesQuery.error as Error | null) ?? (scopesQuery.error as Error | null) ?? null

  return useMemo(
    () => ({ trades, tradesById, tradesBySlug, scopesByTrade, isLoading, error, refetch }),
    [trades, tradesById, tradesBySlug, scopesByTrade, isLoading, error, refetch],
  )
}
