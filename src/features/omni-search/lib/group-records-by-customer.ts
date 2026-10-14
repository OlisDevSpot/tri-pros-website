import type { OmniCustomer, OmniData, OmniStack, OmniStackRecord } from '@/features/omni-search/types'

import { OMNI_STACK_CAPS, OMNI_STACK_KIND_ORDER } from '@/features/omni-search/constants/omni-search'

type RecordsByKind = Record<OmniStackRecord['kind'], OmniStackRecord[]>

// One record of each kind at a time, so a short cap still shows as many kinds as it can; then grouped by kind,
// so a kind's rows sit together.
function takeAcrossKinds(byKind: RecordsByKind, cap: number): OmniStackRecord[] {
  const taken: Record<OmniStackRecord['kind'], number> = { meeting: 0, proposal: 0, project: 0 }
  let total = 0
  for (let round = 0; total < cap; round++) {
    const before = total
    for (const kind of OMNI_STACK_KIND_ORDER) {
      if (total < cap && round < byKind[kind].length) {
        taken[kind]++
        total++
      }
    }
    if (total === before) {
      break
    }
  }
  return OMNI_STACK_KIND_ORDER.flatMap(kind => byKind[kind].slice(0, taken[kind]))
}

/** The desktop grouping: the top customers each carry their own records, the rest are single lines. */
export function groupRecordsByCustomer(data: OmniData): { stacks: OmniStack[], more: OmniCustomer[] } {
  const stacks = data.customers.slice(0, OMNI_STACK_CAPS.length).map((customer, index): OmniStack => {
    const byKind: RecordsByKind = {
      meeting: data.meetings.filter(row => row.customerId === customer.id).map(row => ({ kind: 'meeting', row })),
      proposal: data.proposals.filter(row => row.customerId === customer.id).map(row => ({ kind: 'proposal', row })),
      project: data.projects.filter(row => row.customerId === customer.id).map(row => ({ kind: 'project', row })),
    }
    return { customer, records: takeAcrossKinds(byKind, OMNI_STACK_CAPS[index]) }
  })
  return { stacks, more: data.customers.slice(OMNI_STACK_CAPS.length) }
}
