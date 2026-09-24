'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import type { TRPCClientErrorLike } from '@trpc/client'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import type { AppRouter } from '@/trpc/routers/app'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

interface UsePortfolioProjectsOptions {
  staleTime?: number
}

/**
 * The public portfolio list, for every client surface; when its procedure changes, only this file does.
 * Options are spread only when passed, so the query client's default `staleTime` holds otherwise.
 */
export function usePortfolioProjects(options: UsePortfolioProjectsOptions = {}): UseQueryResult<PortfolioProject[], TRPCClientErrorLike<AppRouter>> {
  const trpc = useTRPC()
  return useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), ...options })
}
