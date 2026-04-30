import { z } from 'zod'

/**
 * Pagination fields. Discrete (offset/limit) — supports jump-to-page UX.
 * The 500 cap is the server-side hard wall; client surfaces should pick a
 * smaller `pageSizeOptions` allowlist (typically [10, 20, 50, 100]).
 */
export const paginationFieldsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(20),
  offset: z.number().int().min(0).default(0),
})

export type PaginationFields = z.infer<typeof paginationFieldsSchema>

/**
 * Sort fields. `sortBy` is loose at this layer — procedures that allow
 * server-side sort narrow it via `buildOrderBy`'s columnMap whitelist.
 */
export const sortFieldsSchema = z.object({
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export type SortFields = z.infer<typeof sortFieldsSchema>

/**
 * ISO datetime range, inclusive on both ends. Used by the toolkit's
 * `date-range` filter type and by any procedure that needs a time window.
 */
export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type DateRange = z.infer<typeof dateRangeSchema>

/**
 * Composer for paginated procedure inputs. Every paginated tRPC procedure
 * should use this so the client `usePaginatedQuery` hook can drive it.
 *
 * Groups by function:
 *   - `pagination`: limit + offset
 *   - `sort`: optional sortBy + sortDir
 *   - `search`: optional debounced free-text
 *   - `filters`: consumer-defined per-procedure shape (always optional)
 *
 * Procedures can `.extend({ id: z.string().uuid() })` to add business inputs
 * at the top level alongside the structured query groups.
 *
 * @example
 *   .input(paginatedQueryInput({
 *     status: z.array(meetingStatusEnum).optional(),
 *     createdAt: dateRangeSchema.optional(),
 *   }).extend({ projectId: z.string().uuid() }))
 *
 * For procedures without filters, pass an empty object: `paginatedQueryInput({})`.
 */
export function paginatedQueryInput<TFilters extends z.ZodRawShape>(filtersShape: TFilters) {
  return z.object({
    pagination: paginationFieldsSchema,
    sort: sortFieldsSchema.optional(),
    search: z.string().optional(),
    filters: z.object(filtersShape).optional(),
  })
}

/**
 * Inferred input type for procedures with no declared filters.
 */
export type PaginatedQueryInputBase = z.infer<ReturnType<typeof paginatedQueryInput<Record<string, never>>>>

/**
 * Reserved top-level keys the toolkit owns. Consumer business inputs (e.g.
 * `id`, `projectId`) must avoid these names to prevent client/server shape
 * collisions.
 */
export const RESERVED_QUERY_INPUT_KEYS = ['pagination', 'sort', 'search', 'filters'] as const
