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

  const matches = useMemo(
    () => matchPortfolioProjects(query.data ?? [], selections, catalog),
    [query.data, selections, catalog],
  )
  const showNoMatchNote = selections.length > 0 && !matches.some(match => match.kind === 'scope' || match.kind === 'trade')

  // Before the catalog loads, `scopesById` is empty, so trade matches would first classify as
  // fallback and then re-sort once it arrives; waiting on it too keeps the opening project stable.
  return { matches, showNoMatchNote, isPending: query.isPending || catalog.isLoading, isError: query.isError, refetch: query.refetch }
}
