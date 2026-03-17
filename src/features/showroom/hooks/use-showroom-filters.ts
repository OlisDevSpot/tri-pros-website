'use client'

import type { ShowroomProject } from '@/shared/entities/projects/types'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { filterShowroomProjects } from '@/features/showroom/lib/filter-projects'

interface UseShowroomFiltersOptions {
  projects: ShowroomProject[]
  allScopes: ScopeOrAddon[]
  allTrades: Trade[]
}

export function useShowroomFilters({ projects, allScopes, allTrades }: UseShowroomFiltersOptions) {
  const [selectedTradeIds, setSelectedTradeIds] = useQueryState(
    'trades',
    parseAsArrayOf(parseAsString).withDefault([]),
  )
  const [selectedScopeIds, setSelectedScopeIds] = useQueryState(
    'scopes',
    parseAsArrayOf(parseAsString).withDefault([]),
  )
  const [searchQuery, setSearchQuery] = useQueryState(
    'q',
    parseAsString.withDefault(''),
  )

  // Build a scope→trade mapping from Notion data
  const scopeToTradeMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of allScopes) {
      map.set(scope.id, scope.relatedTrade)
    }
    return map
  }, [allScopes])

  // Derive available trades and scopes from the project data
  const { availableTrades, availableScopes } = useMemo(() => {
    const usedScopeIds = new Set(projects.flatMap(p => p.scopeIds))
    const usedTradeIds = new Set<string>()

    const scopeItems: { id: string, name: string, tradeId: string }[] = []

    for (const scope of allScopes) {
      if (!usedScopeIds.has(scope.id)) {
        continue
      }
      usedTradeIds.add(scope.relatedTrade)

      if (selectedTradeIds.length === 0 || selectedTradeIds.includes(scope.relatedTrade)) {
        scopeItems.push({ id: scope.id, name: scope.name, tradeId: scope.relatedTrade })
      }
    }

    const tradeItems = allTrades
      .filter(t => usedTradeIds.has(t.id))
      .map(t => ({ id: t.id, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      availableTrades: tradeItems,
      availableScopes: scopeItems.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [projects, allScopes, allTrades, selectedTradeIds])

  // When trades change, clear any scope selections that no longer apply
  const handleTradeChange = (tradeIds: string[]) => {
    setSelectedTradeIds(tradeIds.length > 0 ? tradeIds : null)
    if (tradeIds.length > 0) {
      const validScopes = selectedScopeIds.filter((scopeId) => {
        const tradeId = scopeToTradeMap.get(scopeId)
        return tradeId && tradeIds.includes(tradeId)
      })
      setSelectedScopeIds(validScopes.length > 0 ? validScopes : null)
    }
  }

  const handleScopeChange = (scopeIds: string[]) => {
    setSelectedScopeIds(scopeIds.length > 0 ? scopeIds : null)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query || null)
  }

  const filteredProjects = useMemo(
    () => filterShowroomProjects(projects, {
      tradeIds: selectedTradeIds,
      scopeIds: selectedScopeIds,
      search: searchQuery,
      scopeToTradeMap,
    }),
    [projects, selectedTradeIds, selectedScopeIds, searchQuery, scopeToTradeMap],
  )

  const clearAll = () => {
    setSelectedTradeIds(null)
    setSelectedScopeIds(null)
    setSearchQuery(null)
  }

  const activeFilterCount = selectedTradeIds.length + selectedScopeIds.length + (searchQuery ? 1 : 0)

  return {
    selectedTradeIds,
    selectedScopeIds,
    searchQuery,
    filteredProjects,
    availableTrades,
    availableScopes,
    activeFilterCount,
    setSelectedTradeIds: handleTradeChange,
    setSelectedScopeIds: handleScopeChange,
    setSearchQuery: handleSearchChange,
    clearAll,
  }
}
