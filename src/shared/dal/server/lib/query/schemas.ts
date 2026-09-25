import { z } from 'zod'

/** The 500 cap exists for date-windowed calendar/kanban slices; table consumers stay within `pageSizeOptions`. */
export const paginationFieldsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(20),
  offset: z.number().int().min(0).default(0),
})

export type PaginationFields = z.infer<typeof paginationFieldsSchema>

/** `sortBy` is deliberately loose here — `buildOrderBy`'s columnMap whitelists it per procedure. */
export const sortFieldsSchema = z.object({
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export type SortFields = z.infer<typeof sortFieldsSchema>

// zod's .datetime() accepts year 0000, which Postgres rejects with a 500; an out-of-range
// value fails validation so the filter collapses to inactive on both the parser and procedure paths.
const pgSafeDatetime = z.string().datetime().refine((s) => {
  const t = Date.parse(s)
  return Number.isFinite(t) && t >= Date.UTC(1970, 0, 1) && t <= Date.UTC(2200, 0, 1)
}, 'Date out of supported range')

/** Inclusive on both ends. */
export const dateRangeSchema = z.object({
  from: pgSafeDatetime.optional(),
  to: pgSafeDatetime.optional(),
})

export type DateRange = z.infer<typeof dateRangeSchema>

/** Inclusive on both ends; `undefined` on a side means open-ended. */
export const numberRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
})

export type NumberRange = z.infer<typeof numberRangeSchema>

export function paginatedQueryInput<TFilters extends z.ZodRawShape>(filtersShape: TFilters) {
  return z.object({
    pagination: paginationFieldsSchema,
    sort: sortFieldsSchema.optional(),
    search: z.string().optional(),
    filters: z.object(filtersShape).optional(),
  })
}

export type PaginatedQueryInputBase = z.infer<ReturnType<typeof paginatedQueryInput<Record<string, never>>>>

/** Consumer business inputs must not use these names — they would collide with the toolkit's shape. */
export const RESERVED_QUERY_INPUT_KEYS = ['pagination', 'sort', 'search', 'filters'] as const
