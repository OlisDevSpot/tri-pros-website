'use client'

import type { ColumnFiltersState } from '@tanstack/react-table'
import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { parseAsString, useQueryStates } from 'nuqs'
import { useCallback, useMemo } from 'react'

/**
 * @deprecated Use `usePaginatedQuery` + `<QueryToolbar>` for new server-paginated
 * tables. Known limitation: parses every filter value as a string, which silently
 * breaks `multi-select` filters (arrays get coerced via `String(value)` to
 * `"a,b,c"` losing the array discriminator). Kept temporarily for legacy
 * client-side tables that haven't been migrated:
 *   - features/schedule-management (Activities)
 *   - features/meeting-flow (Past Meetings)
 *   - features/proposal-flow (Past Proposals)
 *   - features/project-management (Projects portfolio)
 *   - features/customer-pipelines (Customer Pipelines)
 *
 * Each migration is queued as a follow-up issue. See cleanup checklist on PR #151.
 *
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
