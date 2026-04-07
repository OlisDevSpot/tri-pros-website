'use client'

import type { PortfolioProject } from '@/shared/entities/projects/types'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { filterPortfolioProjects } from '@/features/project-management/lib/filter-projects'

interface UsePortfolioFiltersOptions {
  projects: PortfolioProject[]
  allScopes: ScopeOrAddon[]
  allTrades: Trade[]
}

export function usePortfolioFilters({ projects, allScopes, allTrades }: UsePortfolioFiltersOptions) {
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
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )
  const [perPage, setPerPage] = useQueryState(
    'perPage',
    parseAsStringLiteral(['10', '20'] as const).withDefault('10'),
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

  const resetPage = useCallback(() => setPage(null), [setPage])

  // When trades change, clear any scope selections that no longer apply
  const handleTradeChange = (tradeIds: string[]) => {
    setSelectedTradeIds(tradeIds.length > 0 ? tradeIds : null)
    resetPage()
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
    resetPage()
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query || null)
    resetPage()
  }

  const filteredProjects = useMemo(
    () => filterPortfolioProjects(projects, {
      tradeIds: selectedTradeIds,
      scopeIds: selectedScopeIds,
      search: searchQuery,
      scopeToTradeMap,
    }),
    [projects, selectedTradeIds, selectedScopeIds, searchQuery, scopeToTradeMap],
  )

  const perPageNum = Number(perPage)
  const totalFiltered = filteredProjects.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPageNum))
  const safePage = Math.min(page, totalPages)

  const paginatedProjects = useMemo(
    () => filteredProjects.slice((safePage - 1) * perPageNum, safePage * perPageNum),
    [filteredProjects, safePage, perPageNum],
  )

  const clearAll = () => {
    setSelectedTradeIds(null)
    setSelectedScopeIds(null)
    setSearchQuery(null)
    resetPage()
  }

  const handlePerPageChange = (value: '10' | '20') => {
    setPerPage(value === '10' ? null : value)
    resetPage()
  }

  const activeFilterCount = selectedTradeIds.length + selectedScopeIds.length + (searchQuery ? 1 : 0)

  return {
    selectedTradeIds,
    selectedScopeIds,
    searchQuery,
    filteredProjects: paginatedProjects,
    totalFiltered,
    availableTrades,
    availableScopes,
    activeFilterCount,
    page: safePage,
    perPage,
    totalPages,
    setPage: (p: number) => setPage(p === 1 ? null : p),
    setPerPage: handlePerPageChange,
    setSelectedTradeIds: handleTradeChange,
    setSelectedScopeIds: handleScopeChange,
    setSearchQuery: handleSearchChange,
    clearAll,
  }
}
