import type { SQL } from 'drizzle-orm'

import { and } from 'drizzle-orm'

/**
 * Type-level: a predicate builder for one filter key. Returns a Drizzle SQL
 * fragment, or undefined to opt-out of the WHERE for that key.
 */
export type FilterPredicateBuilder<TValue> = (value: TValue) => SQL | undefined

/**
 * Build a Drizzle WHERE fragment from a filters object using a per-key
 * predicate map. Keys whose value is `undefined` (i.e. the consumer didn't
 * pass that filter) are skipped. Keys whose builder returns `undefined` are
 * also skipped — useful when an empty array or empty range should produce no
 * predicate.
 *
 * Returns `undefined` when no filters produced a predicate, so the caller
 * can pass it straight to `and(...)` without further checks.
 *
 * @example
 *   const filterWhere = buildFilterWhere(input.filters, {
 *     status: (v) => inArray(meetings.status, v),
 *     createdAt: (v) => and(
 *       v.from ? gte(meetings.createdAt, v.from) : undefined,
 *       v.to ? lte(meetings.createdAt, v.to) : undefined,
 *     ),
 *   })
 *   const where = and(baseMatch, searchWhere, filterWhere)
 */
export function buildFilterWhere<TFilters extends Record<string, unknown>>(
  filters: TFilters | undefined,
  predicateMap: { [K in keyof TFilters]?: FilterPredicateBuilder<NonNullable<TFilters[K]>> },
): SQL | undefined {
  if (!filters) {
    return undefined
  }

  const fragments: SQL[] = []
  for (const key of Object.keys(filters) as (keyof TFilters)[]) {
    const value = filters[key]
    if (value === undefined || value === null) {
      continue
    }
    const builder = predicateMap[key]
    if (!builder) {
      continue
    }
    const fragment = builder(value as NonNullable<TFilters[typeof key]>)
    if (fragment) {
      fragments.push(fragment)
    }
  }

  if (fragments.length === 0) {
    return undefined
  }
  if (fragments.length === 1) {
    return fragments[0]
  }
  return and(...fragments)
}
