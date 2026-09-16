'use client'

// LAZY: reads `projectsRouter.showroomDisplay.getAll` until the Who We Are round 2 projects read model lands
// (docs/plans/2026-09-14-upgrading-meeting-flow-epic.md R3 `scopeIds` filter, R10 public projection, S1).
// Swap the query in this file (Task 9); `ShowcaseProjectIndex` stays the contract for every consumer.

import type { ShowcaseProjectIndex, TradeScopeGroup } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { indexShowcaseProjects } from '@/features/meeting-flow/lib/index-showcase-projects'
import { useTRPC } from '@/trpc/helpers'

/**
 * Portfolio projects with a hero image, indexed by trade and scope. Empty while loading or on
 * error: the showcase falls back, silently.
 *
 * `scopesByTrade` must keep a stable identity across renders — memoize it at the source, as
 * `useTradeCatalog` does. A map rebuilt inline on every render rebuilds the whole index with it.
 */
export function useShowcaseProjects(scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex {
  const trpc = useTRPC()
  const query = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })
  return useMemo(() => indexShowcaseProjects(query.data ?? [], scopesByTrade), [query.data, scopesByTrade])
}
