'use client'

import { useQuery } from '@tanstack/react-query'
import { useShowroomFilters } from '@/features/showroom/hooks/use-showroom-filters'
import { ShowroomFilterBar } from '@/features/showroom/ui/components/showroom-filter-bar'
import { ShowroomGrid } from '@/features/showroom/ui/components/showroom-grid'
import { ShowroomHero } from '@/features/showroom/ui/components/showroom-hero'
import { ShowroomPagination } from '@/features/showroom/ui/components/showroom-pagination'
import { useTRPC } from '@/trpc/helpers'

export function ShowroomGridView() {
  const trpc = useTRPC()

  const { data: projects = [], isLoading: projectsLoading } = useQuery(
    trpc.projectsRouter.getPortfolioProjects.queryOptions(),
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
  } = useShowroomFilters({ projects, allScopes, allTrades })

  return (
    <>
      {/* Gallery-wall hero */}
      <ShowroomHero projects={projects} />

      <section className="bg-background py-12 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Filter Bar */}
          <div className="mb-10">
            <ShowroomFilterBar
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
              <ShowroomPagination
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
            : <ShowroomGrid projects={filteredProjects} allScopes={allScopes} allTrades={allTrades} />}

          {/* Pagination */}
          {!projectsLoading && (
            <div className="mt-10">
              <ShowroomPagination
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
