'use client'

import type { ScheduleTableTab } from '../types'

import { useCallback } from 'react'

import { usePersistedState } from '@/shared/hooks/use-persisted-state'

export function useScheduleTableTab() {
  const [tab, setTab] = usePersistedState<ScheduleTableTab>(
    'tri-pros:schedule-table-tab',
    'meetings',
  )
  const handleTabChange = useCallback((newTab: ScheduleTableTab) => {
    setTab(newTab)
  }, [setTab])
  return { tab, setTab: handleTabChange }
}
