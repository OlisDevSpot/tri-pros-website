'use client'

import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { PREFETCH_AHEAD } from '@/features/meeting-flow/constants/portfolio-step'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTRPC } from '@/trpc/helpers'

/** The detail (media by phase) of the project on screen, with the next few fetched ahead so ↓ never waits. */
export function usePortfolioProjectDetail(matches: PortfolioMatch[], projectIndex: number) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const accessor = matches[projectIndex]?.row.project.accessor

  const detail = useQuery({
    ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: accessor ?? '' }),
    enabled: accessor !== undefined,
    staleTime: SHOWCASE_PROJECTS_STALE_MS,
  })

  useEffect(() => {
    for (const ahead of matches.slice(projectIndex + 1, projectIndex + 1 + PREFETCH_AHEAD)) {
      void queryClient.prefetchQuery({
        ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: ahead.row.project.accessor }),
        staleTime: SHOWCASE_PROJECTS_STALE_MS,
      })
    }
  }, [matches, projectIndex, queryClient, trpc])

  return detail
}
