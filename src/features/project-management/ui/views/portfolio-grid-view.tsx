'use client'

import { useQuery } from '@tanstack/react-query'
import { usePortfolioFilters } from '@/features/project-management/hooks/use-portfolio-filters'
import { PortfolioFilterBar } from '@/features/project-management/ui/components/portfolio-filter-bar'
import { PortfolioGrid } from '@/features/project-management/ui/components/portfolio-grid'
import { PortfolioHero } from '@/features/project-management/ui/components/portfolio-hero'
import { PortfolioPagination } from '@/features/project-management/ui/components/portfolio-pagination'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioGridView() {
  const trpc = useTRPC()

  const { data: projects = [], isLoading: projectsLoading } = useQuery(
    trpc.projectsRouter.showroomDisplay.getAll.queryOptions(),
  )

  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const {
    selectedTradeIds,
    selectedScopeIds,
    searchQuery,
    filteredProjects,
    totalFiltered,
    availableTrades,
    availableScopes,
    activeFilterCount,
    page,
    perPage,
    totalPages,
    setPage,
    setPerPage,
    setSelectedTradeIds,
    setSelectedScopeIds,
    setSearchQuery,
    clearAll,
  } = usePortfolioFilters({ projects, allScopes, allTrades })

  return (
    <>
      {/* Gallery-wall hero */}
      <PortfolioHero projects={projects} />

      <section className="bg-background py-12 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Filter Bar */}
          <div className="mb-10">
            <PortfolioFilterBar
              trades={availableTrades}
              scopes={availableScopes}
              selectedTradeIds={selectedTradeIds}
              selectedScopeIds={selectedScopeIds}
              searchQuery={searchQuery}
              activeFilterCount={activeFilterCount}
              onTradeChange={setSelectedTradeIds}
              onScopeChange={setSelectedScopeIds}
              onSearchChange={setSearchQuery}
              onClear={clearAll}
            />
          </div>

          {/* Top pagination — desktop only */}
          {!projectsLoading && (
            <div className="mb-6 hidden sm:block">
              <PortfolioPagination
                page={page}
                totalPages={totalPages}
                totalFiltered={totalFiltered}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
              />
            </div>
          )}

          {/* Grid */}
          {projectsLoading
            ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="aspect-4/3 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              )
            : <PortfolioGrid projects={filteredProjects} allScopes={allScopes} allTrades={allTrades} />}

          {/* Pagination */}
          {!projectsLoading && (
            <div className="mt-10">
              <PortfolioPagination
                page={page}
                totalPages={totalPages}
                totalFiltered={totalFiltered}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
