import type { AnyColumn, SQL } from 'drizzle-orm'

import type { SortFields } from '@/shared/dal/server/query/schemas'

import { asc, desc } from 'drizzle-orm'

type SortTarget = AnyColumn | SQL

/**
 * Translate a query input's `sort` group into a Drizzle `orderBy` argument
 * list. The `columnMap` whitelists which keys are sortable and maps each to
 * a column or SQL expression — this is the boundary that prevents a malicious
 * `sortBy: 'password'` from reaching SQL.
 *
 * Falls back to `fallback` (typically the table's natural order) when:
 *   - `sort` is undefined
 *   - `sort.sortBy` is undefined
 *   - `sort.sortBy` is not in the whitelist (treated as no-op, never an error)
 *
 * Spread the result into `.orderBy(...)`:
 *
 * @example
 *   .orderBy(...buildOrderBy(input.sort, {
 *     name: customers.name,
 *     email: customers.email,
 *     createdAt: customers.createdAt,
 *   }, desc(customers.createdAt)))
 */
export function buildOrderBy<TKey extends string>(
  sort: SortFields | undefined,
  columnMap: Record<TKey, SortTarget>,
  fallback: SQL,
): SQL[] {
  const sortBy = sort?.sortBy
  if (!sortBy || !(sortBy in columnMap)) {
    return [fallback]
  }
  const column = columnMap[sortBy as TKey]
  return [sort.sortDir === 'asc' ? asc(column) : desc(column)]
}
