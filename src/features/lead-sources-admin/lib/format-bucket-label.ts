import { addDays, format } from 'date-fns'

export type Bucket = 'day' | 'week' | 'month'

/**
 * Formats an ISO bucket-start date for trend-chart axes and tooltips.
 *
 * - `day`    → "Apr 14"
 * - `week`   → "Apr 14" (week starting; tooltip handler may render the range)
 * - `month`  → "Apr 2026"
 */
export function formatBucketLabel(iso: string, bucket: Bucket): string {
  const d = new Date(iso)
  if (bucket === 'month') {
    return format(d, 'MMM yyyy')
  }
  return format(d, 'MMM d')
}

/**
 * Renders a tooltip-friendly date range for a bucket — e.g. "Apr 14" for day,
 * "Apr 14 – Apr 20" for week, "April 2026" for month.
 */
export function formatBucketRange(iso: string, bucket: Bucket): string {
  const start = new Date(iso)
  if (bucket === 'day') {
    return format(start, 'MMM d, yyyy')
  }
  if (bucket === 'month') {
    return format(start, 'MMMM yyyy')
  }
  // week: 7-day span ending on day 6
  const end = addDays(start, 6)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}
