/**
 * Standardized response shape returned by every paginated tRPC procedure.
 * The client `usePaginatedQuery` hook depends on this contract.
 */
export interface PaginatedResult<T> {
  rows: T[]
  total: number
}

/**
 * Ergonomic helper that runs a page query and a count query in parallel and
 * returns them in the standard `PaginatedResult` shape. Procedures that need
 * to compose differently (e.g. complex joined counts) can skip this and
 * return `{ rows, total }` directly.
 */
export async function paginate<T>(args: {
  query: () => Promise<T[]>
  count: () => Promise<number>
}): Promise<PaginatedResult<T>> {
  const [rows, total] = await Promise.all([args.query(), args.count()])
  return { rows, total }
}
