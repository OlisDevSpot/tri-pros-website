import type { OmniData, RankedOmniEntry } from '@/features/omni-search/types'

/** The cmdk `value` of the row that renders first: the top customer (a stack head on desktop), else the first entry. */
export function firstOmniValue(ranked: RankedOmniEntry[], data: OmniData | undefined, entriesFirst: boolean): string | undefined {
  const entry = (ranked.find(r => r.entry.group === 'go-to') ?? ranked.find(r => r.entry.group === 'actions'))?.entry.id
  // Every record row hangs under a customer, so the first record row in either layout is the first customer.
  const customer = data?.customers[0]
  const record = customer && `customer:${customer.id}`
  return entriesFirst ? (entry ?? record) : (record ?? entry)
}
