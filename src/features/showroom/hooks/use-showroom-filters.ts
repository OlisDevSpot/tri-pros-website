'use client'

import type { ShowroomProject } from '@/shared/entities/projects/types'
import { useMemo, useState } from 'react'
import { filterShowroomProjects } from '../lib/filter-projects'

interface UseShowroomFiltersOptions {
  projects: ShowroomProject[]
}

export function useShowroomFilters({ projects }: UseShowroomFiltersOptions) {
  const [selectedTradeIds, setSelectedTradeIds] = useState<number[]>([])
  const [selectedScopeIds, setSelectedScopeIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Derive available scopes from projects, filtered by selected trades
  const availableScopes = useMemo(() => {
    const scopeMap = new Map<number, { id: number, label: string, tradeId: number }>()
    for (const project of projects) {
      for (const scope of project.scopes) {
        if (selectedTradeIds.length === 0 || selectedTradeIds.includes(scope.tradeId)) {
          scopeMap.set(scope.id, scope)
        }
      }
    }
    return Array.from(scopeMap.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [projects, selectedTradeIds])

  // When trades change, clear any scope selections that no longer apply
  const handleTradeChange = (tradeIds: number[]) => {
    setSelectedTradeIds(tradeIds)
    if (tradeIds.length > 0) {
      setSelectedScopeIds(prev =>
        prev.filter((scopeId) => {
          const scope = availableScopes.find(s => s.id === scopeId)
          return scope && tradeIds.includes(scope.tradeId)
        }),
      )
    }
  }

  const filteredProjects = useMemo(
    () => filterShowroomProjects(projects, {
      tradeIds: selectedTradeIds,
      scopeIds: selectedScopeIds,
      search: searchQuery,
    }),
    [projects, selectedTradeIds, selectedScopeIds, searchQuery],
  )

  const clearAll = () => {
    setSelectedTradeIds([])
    setSelectedScopeIds([])
    setSearchQuery('')
  }

  const activeFilterCount = selectedTradeIds.length + selectedScopeIds.length + (searchQuery ? 1 : 0)

  return {
    selectedTradeIds,
    selectedScopeIds,
    searchQuery,
    filteredProjects,
    availableScopes,
    activeFilterCount,
    setSelectedTradeIds: handleTradeChange,
    setSelectedScopeIds,
    setSearchQuery,
    clearAll,
  }
}
