'use client'

import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { matchPortfolioProjects } from '@/features/meeting-flow/lib/match-portfolio-projects'
import { usePortfolioProjects } from '@/shared/modules/projects/core/hooks/use-portfolio-projects'

export function usePortfolioMatches() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const query = usePortfolioProjects({ staleTime: SHOWCASE_PROJECTS_STALE_MS })

  const isPending = query.isPending || catalog.isLoading
  // Navigation adopts matches[0] as the opening project, so it must not see a pre-catalog order.
  const matches = useMemo(
    () => (isPending ? [] : matchPortfolioProjects(query.data ?? [], selections, catalog)),
    [isPending, query.data, selections, catalog],
  )
  const showNoMatchNote = selections.length > 0 && !matches.some(match => match.kind === 'scope' || match.kind === 'trade')

  // A failed background refetch keeps the cached list on screen; only a list that never loaded shows the error.
  return { matches, showNoMatchNote, isPending, isError: query.isError && query.data === undefined, refetch: query.refetch }
}
