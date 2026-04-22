/**
 * Time-range chips for the performance strip.
 *
 * `rolling` entries compute {from, to} at query time. `year` entries select
 * a specific year (Jan 1 → Dec 31). `all` omits both bounds.
 */

export type TimeRangeKey = string

export interface TimeRangeChip {
  key: TimeRangeKey
  label: string
  kind: 'rolling' | 'year' | 'all'
  /** For 'rolling' kind: number of days back from now. */
  days?: number
  /** For 'year' kind: the full year (e.g. 2025). */
  year?: number
}

export const DEFAULT_RANGE_KEY: TimeRangeKey = 'this-month'

// Chronological order: shortest rolling window first, then this-month (which
// is close to 30d but semantically distinct), then longer windows, then "all
// time" as the terminator. Years append after this list.
export const BASE_TIME_RANGE_CHIPS: readonly TimeRangeChip[] = [
  { key: '7d', label: '7d', kind: 'rolling', days: 7 },
  { key: 'this-month', label: 'This month', kind: 'rolling', days: 30 },
  { key: '30d', label: '30d', kind: 'rolling', days: 30 },
  { key: '90d', label: '90d', kind: 'rolling', days: 90 },
  { key: 'all', label: 'All time', kind: 'all' },
] as const
