import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

/**
 * Resolve a time-range chip into concrete {from, to} ISO strings for the
 * stats query. `rolling` kinds roll forward to "now"; `year` pins Jan 1 →
 * Dec 31 (or Dec 31 23:59:59 UTC for the "to" boundary). `all` omits both.
 */
export function resolveTimeRange(chip: TimeRangeChip): { from?: string, to?: string } {
  if (chip.kind === 'all') {
    return {}
  }
  if (chip.kind === 'year' && chip.year != null) {
    const from = new Date(Date.UTC(chip.year, 0, 1, 0, 0, 0))
    const to = new Date(Date.UTC(chip.year, 11, 31, 23, 59, 59, 999))
    return { from: from.toISOString(), to: to.toISOString() }
  }
  if (chip.kind === 'rolling' && chip.days != null) {
    const to = new Date()
    const from = new Date(to.getTime() - chip.days * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString() }
  }
  return {}
}

/** Build the complete chip list: rolling + years with activity + all. */
export function buildChipsWithYears(
  base: readonly TimeRangeChip[],
  activeYears: readonly number[],
): readonly TimeRangeChip[] {
  const yearChips: TimeRangeChip[] = activeYears.map(y => ({
    key: `year-${y}`,
    label: String(y),
    kind: 'year' as const,
    year: y,
  }))
  // Insert year chips between rolling and 'all' so the order scans: recent first,
  // then calendar years for audit, then all-time for totals.
  const rolling = base.filter(c => c.kind !== 'all')
  const all = base.filter(c => c.kind === 'all')
  return [...rolling, ...yearChips, ...all]
}
