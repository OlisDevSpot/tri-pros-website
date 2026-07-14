import type { Customer } from '@/shared/db/schema'

/**
 * Picks a subset of profile-trio columns (epic #256/#259) off a customer row
 * into a plain record — used by the profile display cards, which previously
 * read straight off a JSONB blob and now read straight off the row.
 */
export function pickProfileColumns<K extends readonly (keyof Customer)[]>(
  customer: Customer,
  keys: K,
): Pick<Customer, K[number]> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    result[key] = customer[key]
  }
  return result as Pick<Customer, K[number]>
}
