import type { OmniData, RankedOmniEntry } from '@/features/omni-search/types'

/**
 * Whether the Go to and Actions rows stand above the records: only when the best entry outranks the best customer.
 * Before an open's first answer the records' slot (the skeleton) goes first, where matching customers land, so their
 * arrival moves nothing; a term no customer matches moves Go to up once, above the no-match note.
 */
export function omniEntriesFirst(ranked: RankedOmniEntry[], data: OmniData | undefined, pending: boolean): boolean {
  if (!data) {
    return false
  }
  return (ranked[0]?.score ?? 0) > (pending ? 0 : Math.min(data.customers[0]?.score ?? 0, 1))
}
