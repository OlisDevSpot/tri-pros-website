'use client'

import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import { useEffect, useMemo, useState } from 'react'

export interface KanbanStageFilterConfig {
  /** Stage keys that are visible by default. If omitted, all stages are visible. */
  defaultVisible?: string[]
  /** Stage keys that cannot be hidden (checkbox disabled). */
  alwaysVisible?: string[]
}

export function useKanbanStageFilter(
  stageConfig: readonly KanbanStageConfig[],
  stageFilter?: KanbanStageFilterConfig,
) {
  const [visibleStages, setVisibleStages] = useState<Set<string>>(() => {
    if (stageFilter?.defaultVisible) {
      return new Set(stageFilter.defaultVisible)
    }
    return new Set(stageConfig.map(s => s.key))
  })

  const stageKeys = stageConfig.map(s => s.key).join(',')
  useEffect(() => {
    if (stageFilter?.defaultVisible) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(stageFilter.defaultVisible))
    }
    else {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(stageConfig.map(s => s.key)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when stages change
  }, [stageKeys])

  const alwaysVisible = useMemo(
    () => new Set(stageFilter?.alwaysVisible ?? []),
    [stageFilter?.alwaysVisible],
  )

  const isFiltering = stageFilter !== undefined
  const filteredStageConfig = useMemo(
    () => (isFiltering ? stageConfig.filter(s => visibleStages.has(s.key)) : stageConfig),
    [isFiltering, stageConfig, visibleStages],
  )

  function handleToggleStage(key: string) {
    setVisibleStages((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      }
      else {
        next.add(key)
      }
      return next
    })
  }

  function handleShowAll() {
    setVisibleStages(new Set(stageConfig.map(s => s.key)))
  }

  function handleHideAll() {
    setVisibleStages(new Set(stageFilter?.alwaysVisible ?? []))
  }

  return {
    visibleStages,
    alwaysVisible,
    filteredStageConfig,
    handleToggleStage,
    handleShowAll,
    handleHideAll,
  }
}
