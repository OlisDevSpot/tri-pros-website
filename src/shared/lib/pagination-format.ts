/**
 * Format `Page X of Y` with locale-aware numbers and a non-breaking space
 * between the numerals and their labels so the pair never wraps awkwardly.
 *
 * Returns the raw string (caller is responsible for `tabular-nums` +
 * `whitespace-nowrap` on the rendering element).
 */
export function formatPageOf(page: number, pageCount: number, locale?: string): string {
  const fmt = new Intl.NumberFormat(locale)
  const NBSP = ' '
  const safePageCount = Math.max(pageCount, 1)
  const safePage = Math.min(Math.max(page, 1), safePageCount)
  return `Page${NBSP}${fmt.format(safePage)} of${NBSP}${fmt.format(safePageCount)}`
}

/**
 * Format a total count for display in toolbars and headers. Uses locale-aware
 * grouping separators (e.g. `1,234`).
 */
export function formatTotalCount(total: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(total)
}
