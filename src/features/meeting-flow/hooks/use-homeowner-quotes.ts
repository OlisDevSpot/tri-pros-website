'use client'

// LAZY: the same read as `useShowcaseProjects` (`projectsRouter.showroomDisplay.getAll`); swap
// both together when the projects read model lands.

import type { HomeownerQuote } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { HOMEOWNER_QUOTE_LIMIT, HOMEOWNER_QUOTE_MAX_LENGTH } from '@/features/meeting-flow/constants/homeowner-quotes'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { pickHomeownerQuotes } from '@/features/meeting-flow/lib/pick-homeowner-quotes'
import { useTRPC } from '@/trpc/helpers'

/**
 * Up to three portfolio homeowners' words, projects in the meeting's trades first. The
 * provider fired this query when the meeting opened, with the same options, so the cache
 * answers. Empty while loading or on error: the slide is whole without a quote.
 */
export function useHomeownerQuotes(): HomeownerQuote[] {
  const trpc = useTRPC()
  const query = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const preferredTradeIds = useMemo(() => new Set(selections.map(selection => selection.tradeId)), [selections])

  return useMemo(() => pickHomeownerQuotes(query.data ?? [], {
    scopesByTrade: catalog.scopesByTrade,
    tradesById: catalog.tradesById,
    preferredTradeIds,
    limit: HOMEOWNER_QUOTE_LIMIT,
    maxLength: HOMEOWNER_QUOTE_MAX_LENGTH,
  }), [query.data, catalog.scopesByTrade, catalog.tradesById, preferredTradeIds])
}
