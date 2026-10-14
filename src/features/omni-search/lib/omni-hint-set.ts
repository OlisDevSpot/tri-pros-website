import type { OmniData, OmniHintSet, OmniView } from '@/features/omni-search/types'

interface HintInput {
  /** cmdk's highlighted value. */
  highlighted: string
  data: OmniData | undefined
  pending: boolean
  view: OmniView
  /** Focus is in a contact capsule or its open menu. */
  inContact: boolean
}

/** Which key hints the footer shows: → is offered only where it works (a settled customer row with a capsule). */
export function omniHintSet({ highlighted, data, pending, view, inContact }: HintInput): OmniHintSet {
  if (inContact) {
    return 'contact'
  }
  if (view === 'pick' || pending) {
    return 'default'
  }
  const customer = data?.customers.find(row => `customer:${row.id}` === highlighted)
  return customer && (customer.phone || customer.email || customer.address) ? 'customer' : 'default'
}
