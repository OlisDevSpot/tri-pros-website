import type { AnyColumn, SQL } from 'drizzle-orm'

import type { FieldList, FilterId, FilterValue, FilterValues, SortDir, SortId, SortState } from '@/shared/dal/lib/query/field-list'
import type { DateRange } from '@/shared/dal/lib/query/range-schemas'

import { and, asc, desc, gte, lte, sql } from 'drizzle-orm'

import { filterParserRegistry } from '@/shared/dal/lib/query/filter-parser-registry'
import 'server-only'

/** One condition per filter and one target per sort; a missing, extra or misspelled key fails `pnpm tsc`. */
export interface FieldSqlMap<F extends FieldList> {
  filter: { [K in FilterId<F>]: (value: FilterValue<F, K>) => SQL | undefined }
  sort: { [K in SortId<F>]: AnyColumn | SQL }
}

interface FieldOrder {
  /** The read's natural order when no sort is chosen. */
  defaultOrder: readonly SQL[]
  /** A unique column, so rows that share a sort value keep one order across pages and refetches. */
  tieBreaker: AnyColumn
}

/** An entity's server-only field SQL: the per-field map plus the `WHERE` and `ORDER BY` built from it. */
export interface FieldSql<F extends FieldList> extends FieldSqlMap<F> {
  where: (filters: FilterValues<F> | undefined) => SQL | undefined
  orderBy: (sort: SortState<F> | undefined) => SQL[]
}

function isActive(field: FieldList[string] | undefined, value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }
  const kind = field?.filter?.kind
  if (!kind || kind === 'fixed') {
    return true
  }
  const { normalize } = filterParserRegistry[kind] as { normalize: (raw: unknown) => unknown }
  return normalize(value) !== undefined
}

// Postgres sorts NULL first on DESC. Even a NOT NULL column reads NULL on rows a LEFT JOIN left unmatched.
function sortTerm(target: AnyColumn | SQL, dir: SortDir): SQL {
  const ordered = dir === 'asc' ? asc(target) : desc(target)
  return sql`${ordered} nulls last`
}

export function defineFieldSql<F extends FieldList>(fields: F, map: NoInfer<FieldSqlMap<F>>, order: FieldOrder): FieldSql<F> {
  const fieldList: FieldList = fields
  // Widened once: the mapped keys are conditional types, so the map can't be indexed by a plain id.
  const conditions = map.filter as Record<string, (value: unknown) => SQL | undefined>
  const targets = map.sort as Record<string, AnyColumn | SQL>

  return {
    ...map,
    where: (filters) => {
      if (!filters) {
        return undefined
      }
      const active: SQL[] = []
      for (const [id, value] of Object.entries(filters)) {
        if (!conditions[id] || !isActive(fieldList[id], value)) {
          continue
        }
        const condition = conditions[id](value)
        if (condition) {
          active.push(condition)
        }
      }
      return active.length > 0 ? and(...active) : undefined
    },
    orderBy: (sort) => {
      if (sort && !targets[sort.sortBy]) {
        throw new Error(`[defineFieldSql] '${sort.sortBy}' is not a sortable field`)
      }
      const chosen = sort ? [sortTerm(targets[sort.sortBy], sort.sortDir)] : [...order.defaultOrder]
      return [...chosen, asc(order.tieBreaker)]
    },
  }
}

/** Inclusive on both ends, like `dateRangeSchema`. */
export function dateRangeCondition(column: AnyColumn, range: DateRange): SQL | undefined {
  return and(
    range.from ? gte(column, range.from) : undefined,
    range.to ? lte(column, range.to) : undefined,
  )
}
