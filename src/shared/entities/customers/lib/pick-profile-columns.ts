/**
 * Picks a subset of profile-trio columns (Addendum B — `customer_profiles`
 * child table + `age`) off a composed customer row into a plain record —
 * used by the profile display cards, which previously read straight off a
 * JSONB blob and now read straight off the joined row. Generic over the row
 * type so callers don't need to widen/narrow the DB row shape.
 */
export function pickProfileColumns<T extends Record<string, unknown>, K extends readonly (keyof T)[]>(
  row: T,
  keys: K,
): Pick<T, K[number]> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    result[key as string] = row[key]
  }
  return result as Pick<T, K[number]>
}
