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
