import type { AnyColumn, SQL } from 'drizzle-orm'

import { ilike, or } from 'drizzle-orm'

/**
 * Translate a paginated input's `search` into a Drizzle `where` fragment that
 * `ilike`s the term against each of the provided columns (joined with OR).
 * Returns `undefined` when `search` is missing/empty so the caller can pass it
 * straight to `and(...)` without further checks.
 *
 * @example
 *   const searchWhere = buildSearchWhere(input.search, [customers.name, customers.email])
 *   const where = and(otherFilter, searchWhere)
 *
 * Wraps each term with `%...%` (substring match). For prefix-only or
 * full-text needs, write the `where` clause inline rather than using this.
 */
export function buildSearchWhere(
  search: string | undefined,
  columns: AnyColumn[],
): SQL | undefined {
  const term = search?.trim()
  if (!term || columns.length === 0) {
    return undefined
  }
  const pattern = `%${term}%`
  return or(...columns.map(c => ilike(c, pattern)))
}
