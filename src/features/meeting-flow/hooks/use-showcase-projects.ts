'use client'

import type { ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { indexShowcaseProjects } from '@/features/meeting-flow/lib/index-showcase-projects'
import { usePortfolioProjects } from '@/shared/modules/projects/core/hooks/use-portfolio-projects'

/**
 * Portfolio projects with a hero image, indexed by trade and scope. Empty while loading or on
 * error: the showcase falls back, silently.
 *
 * `scopesById` must keep a stable identity across renders — memoize it at the source, as
 * `useConstructionCatalog` does. A map rebuilt inline on every render rebuilds the whole index with it.
 */
export function useShowcaseProjects(scopesById: ReadonlyMap<string, Scope>): ShowcaseProjectIndex {
  const query = usePortfolioProjects({ staleTime: SHOWCASE_PROJECTS_STALE_MS })
  return useMemo(() => indexShowcaseProjects(query.data ?? [], scopesById), [query.data, scopesById])
}
