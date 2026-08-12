import type { AnyColumn, SQL } from 'drizzle-orm'

import type { SortFields } from '@/shared/dal/server/lib/query/schemas'

import { asc, desc } from 'drizzle-orm'

type SortTarget = AnyColumn | SQL

/**
 * Translate a query input's `sort` group into a Drizzle `orderBy` argument
 * list. The `columnMap` whitelists which keys are sortable and maps each to
 * a column or SQL expression — this is the boundary that prevents a malicious
 * `sortBy: 'password'` from reaching SQL.
 *
 * Order is resolved by precedence:
 *   1. Explicit `sort.sortBy` when whitelisted in `columnMap`.
 *   2. Explicit `fallback` (escape hatch for a non-`createdAt` natural order).
 *   3. `createdAt` convention — `desc(columnMap.createdAt)` when the map has a
 *      `createdAt` key. This is the default for every record table.
 *   4. No ordering (natural order) — housekeeping entities with neither a
 *      `createdAt` column nor an explicit `fallback`.
 *
 * Spread the result into `.orderBy(...)`:
 *
 * @example
 *   // Record table — createdAt convention supplies the default, no 3rd arg:
 *   .orderBy(...buildOrderBy(input.sort, {
 *     name: customers.name,
 *     createdAt: customers.createdAt,
 *   }))
 *
 * @example
 *   // Override the default natural order explicitly:
 *   .orderBy(...buildOrderBy(input.sort, { name: customers.name }, asc(customers.name)))
 */
export function buildOrderBy<TKey extends string>(
  sort: SortFields | undefined,
  columnMap: Record<TKey, SortTarget>,
  fallback?: SQL,
): SQL[] {
  const sortBy = sort?.sortBy
  if (sortBy && sortBy in columnMap) {
    const column = columnMap[sortBy as TKey]
    return [sort.sortDir === 'asc' ? asc(column) : desc(column)]
  }
  if (fallback) {
    return [fallback]
  }
  if ('createdAt' in columnMap) {
    return [desc((columnMap as Record<string, SortTarget>).createdAt)]
  }
  return []
}
