import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

/**
 * Formats a time-range chip as a trailing clause for the lead-source
 * performance strip (e.g. "this month", "in the last 7 days", "in 2025").
 * Falls back to the chip's own label for any kind without a special phrase.
 */
export function formatTimeRangeClause(chip: TimeRangeChip): string {
  if (chip.key === 'this-month') {
    return 'this month'
  }
  if (chip.kind === 'rolling' && chip.days != null) {
    return `in the last ${chip.days} days`
  }
  if (chip.kind === 'year' && chip.year != null) {
    return `in ${chip.year}`
  }
  return chip.label
}
