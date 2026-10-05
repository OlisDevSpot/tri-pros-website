/**
 * Standardized response shape returned by every paginated tRPC procedure.
 * The client `usePaginatedQuery` hook depends on this contract.
 */
export interface PaginatedResult<T> {
  rows: T[]
  total: number
}
