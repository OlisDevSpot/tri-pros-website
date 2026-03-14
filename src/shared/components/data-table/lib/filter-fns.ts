import type { FilterFn } from '@tanstack/react-table'
import type { TimePreset } from '@/shared/components/data-table/types'

/**
 * Creates a TanStack Table filter function for date range filtering.
 * The filter value is a preset `value` string (e.g. "today", "this-week").
 * The function resolves it against the presets array to get the actual date range.
 */
export function createDateRangeFilterFn<TData>(presets: readonly TimePreset[]): FilterFn<TData> {
  return (row, columnId, filterValue: string) => {
    if (!filterValue) {
      return true
    }

    const preset = presets.find(p => p.value === filterValue)
    if (!preset) {
      return true
    }

    const { from, to } = preset.getRange()
    const cellValue = row.getValue<string | null>(columnId)

    if (!cellValue) {
      return false
    }

    return cellValue >= from && cellValue <= to
  }
}
