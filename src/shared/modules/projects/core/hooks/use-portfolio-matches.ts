'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useMemo } from 'react'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/shared/modules/projects/core/constants/portfolio-match'
import { usePortfolioProjects } from '@/shared/modules/projects/core/hooks/use-portfolio-projects'
import { matchPortfolioProjects } from '@/shared/modules/projects/core/lib/match-portfolio-projects'

/** The portfolio ordered for these selections: the meeting's trade selections, or a proposal's parts. */
export function usePortfolioMatches(selections: TradeSelection[]) {
  const catalog = useConstructionCatalog()
  const query = usePortfolioProjects({ staleTime: SHOWCASE_PROJECTS_STALE_MS })

  const isPending = query.isPending || catalog.isLoading
  // Callers adopt matches[0] as the opening project, so they must not see a pre-catalog order.
  const matches = useMemo(
    () => (isPending ? [] : matchPortfolioProjects(query.data ?? [], selections, catalog)),
    [isPending, query.data, selections, catalog],
  )
  const showNoMatchNote = selections.length > 0 && !matches.some(match => match.kind === 'scope' || match.kind === 'trade')

  // A failed background refetch keeps the cached list on screen; only a list that never loaded shows the error.
  return { matches, showNoMatchNote, isPending, isError: query.isError && query.data === undefined, refetch: query.refetch }
}
