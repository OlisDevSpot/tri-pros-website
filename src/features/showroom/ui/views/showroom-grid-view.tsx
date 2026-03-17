'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { useTRPC } from '@/trpc/helpers'
import { useShowroomFilters } from '@/features/showroom/hooks/use-showroom-filters'
import { ShowroomFilterBar } from '@/features/showroom/ui/components/showroom-filter-bar'
import { ShowroomGrid } from '@/features/showroom/ui/components/showroom-grid'

export function ShowroomGridView() {
  const trpc = useTRPC()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  const { data: projects = [], isLoading: projectsLoading } = useQuery(
    trpc.showroomRouter.getProjects.queryOptions(),
  )

  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const {
    selectedTradeIds,
    selectedScopeIds,
    searchQuery,
    filteredProjects,
    availableTrades,
    availableScopes,
    activeFilterCount,
    setSelectedTradeIds,
    setSelectedScopeIds,
    setSearchQuery,
    clearAll,
  } = useShowroomFilters({ projects, allScopes, allTrades })

  return (
    <section className="bg-background py-20 lg:py-32" ref={ref}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Our
            {' '}
            <span className="text-primary">Projects</span>
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Real transformations. Real families. See how we bring dream homes to life.
          </p>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-10"
        >
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
        </motion.div>

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
      </div>
    </section>
  )
}
