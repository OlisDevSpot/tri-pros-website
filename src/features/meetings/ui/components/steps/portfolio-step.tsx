'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { TradeProjectGrid } from '@/features/meetings/ui/components/steps/trade-project-grid'
import { usePortfolioFilters } from '@/features/project-management/hooks/use-portfolio-filters'
import { PortfolioGrid } from '@/features/project-management/ui/components/portfolio-grid'
import { PortfolioPagination } from '@/features/project-management/ui/components/portfolio-pagination'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Separator } from '@/shared/components/ui/separator'
import { useTRPC } from '@/trpc/helpers'

interface PortfolioStepProps {
  flowContext: MeetingFlowContext
}

export function PortfolioStep({ flowContext }: PortfolioStepProps) {
  const trpc = useTRPC()
  const tradeSelections = useMemo(
    () => flowContext.flowState?.tradeSelections ?? [],
    [flowContext.flowState?.tradeSelections],
  )

  // Fetch all portfolio data (same queries as the public portfolio page)
  const { data: allProjects = [], isLoading: projectsLoading } = useQuery(
    trpc.projectsRouter.showroomDisplay.getAll.queryOptions(),
  )
  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  // Group projects by selected trade — only trades with matching projects
  const tradeProjectGroups = useMemo(() => {
    if (tradeSelections.length === 0 || allProjects.length === 0) {
      return []
    }

    return tradeSelections
      .map((ts) => {
        const selectedScopeIds = new Set(ts.selectedScopes.map(s => s.id))

        const matchingProjects = allProjects.filter((sp: PortfolioProject) =>
          sp.scopeIds.some(scopeId => selectedScopeIds.has(scopeId)),
        )

        return {
          tradeId: ts.tradeId,
          tradeName: ts.tradeName,
          projects: matchingProjects,
        }
      })
      .filter(group => group.projects.length > 0)
  }, [tradeSelections, allProjects])

  // Full portfolio with pagination (reuses portfolio filter hook)
  const portfolioFilters = usePortfolioFilters({ projects: allProjects, allScopes, allTrades })

  if (projectsLoading) {
    return <LoadingState description="Loading portfolio projects..." title="Loading portfolio" />
  }

  return (
    <div className="space-y-12">
      {/* ── Per-Trade Portfolio Grids (filtered views of the same PortfolioGrid) */}
      {tradeProjectGroups.length > 0 && (
        <div className="space-y-10">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Projects matching your selections</h2>
            <p className="text-sm text-muted-foreground">
              Real projects we&apos;ve completed — relevant to the specialties you chose.
            </p>
          </div>

          {tradeProjectGroups.map(group => (
            <TradeProjectGrid
              key={group.tradeId}
              tradeName={group.tradeName}
              projects={group.projects}
              allScopes={allScopes}
              allTrades={allTrades}
            />
          ))}
        </div>
      )}

      {/* ── Divider ────────────────────────────────────────────────────── */}
      {tradeProjectGroups.length > 0 && <Separator />}

      {/* ── Full Portfolio Grid (reused from portfolio page) ───────────── */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Full Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Browse all of our completed projects.
          </p>
        </div>

        {/* Top pagination */}
        <PortfolioPagination
          page={portfolioFilters.page}
          totalPages={portfolioFilters.totalPages}
          totalFiltered={portfolioFilters.totalFiltered}
          perPage={portfolioFilters.perPage}
          onPageChange={portfolioFilters.setPage}
          onPerPageChange={portfolioFilters.setPerPage}
        />

        {/* Grid */}
        <PortfolioGrid
          projects={portfolioFilters.filteredProjects}
          allScopes={allScopes}
          allTrades={allTrades}
        />

        {/* Bottom pagination */}
        <PortfolioPagination
          page={portfolioFilters.page}
          totalPages={portfolioFilters.totalPages}
          totalFiltered={portfolioFilters.totalFiltered}
          perPage={portfolioFilters.perPage}
          onPageChange={portfolioFilters.setPage}
          onPerPageChange={portfolioFilters.setPerPage}
        />
      </div>
    </div>
  )
}
