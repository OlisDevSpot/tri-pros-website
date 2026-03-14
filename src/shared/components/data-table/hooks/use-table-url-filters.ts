'use client'

import type { ColumnFiltersState } from '@tanstack/react-table'
import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { parseAsString, useQueryStates } from 'nuqs'
import { useCallback, useMemo } from 'react'

/**
 * Bridges nuqs URL query params with TanStack Table's columnFilters state.
 * Each filter config becomes a URL param (e.g., ?search=smith&status=sent).
 */
export function useTableUrlFilters(filters: DataTableFilterConfig[]) {
  const parsers = useMemo(() => {
    const result: Record<string, typeof parseAsString> = {}
    for (const filter of filters) {
      result[filter.id] = parseAsString.withDefault('')
    }
    return result
  }, [filters])

  const [urlState, setUrlState] = useQueryStates(parsers, {
    clearOnDefault: true,
  })

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const result: ColumnFiltersState = []
    for (const filter of filters) {
      const value = urlState[filter.id]
      if (value) {
        result.push({ id: filter.columnId, value })
      }
    }
    return result
  }, [filters, urlState])

  const onColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === 'function' ? updater(columnFilters) : updater
      const newUrlState: Record<string, string | null> = {}

      for (const filter of filters) {
        const match = newFilters.find(f => f.id === filter.columnId)
        newUrlState[filter.id] = match ? String(match.value) : null
      }

      setUrlState(newUrlState)
    },
    [columnFilters, filters, setUrlState],
  )

  return { columnFilters, onColumnFiltersChange }
}
