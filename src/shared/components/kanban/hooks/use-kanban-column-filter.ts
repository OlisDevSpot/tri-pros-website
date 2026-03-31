'use client'

import type { KanbanColumnFilterConfig, KanbanStageConfig } from '@/shared/components/kanban/types'

import { useEffect, useMemo, useState } from 'react'

export function useKanbanColumnFilter(
  stageConfig: readonly KanbanStageConfig[],
  columnFilter?: KanbanColumnFilterConfig,
) {
  const [visibleStages, setVisibleStages] = useState<Set<string>>(() => {
    if (columnFilter?.defaultVisible) {
      return new Set(columnFilter.defaultVisible)
    }
    return new Set(stageConfig.map(s => s.key))
  })

  const stageKeys = stageConfig.map(s => s.key).join(',')
  useEffect(() => {
    if (columnFilter?.defaultVisible) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(columnFilter.defaultVisible))
    }
    else {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(stageConfig.map(s => s.key)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when stages change
  }, [stageKeys])

  const alwaysVisible = useMemo(
    () => new Set(columnFilter?.alwaysVisible ?? []),
    [columnFilter?.alwaysVisible],
  )

  const filteredStageConfig = columnFilter
    ? stageConfig.filter(s => visibleStages.has(s.key))
    : stageConfig

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
    setVisibleStages(new Set(columnFilter?.alwaysVisible ?? []))
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
