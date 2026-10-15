'use client'

import type { OmniRecordsProps } from '@/features/omni-search/types'

import { memo, useMemo } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { groupRecordsByCustomer } from '@/features/omni-search/lib/group-records-by-customer'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniCustomerStack } from '@/features/omni-search/ui/components/omni-customer-stack'
import { OmniSeeAllItem } from '@/features/omni-search/ui/components/omni-see-all-item'
import { CommandGroup } from '@/shared/components/ui/command'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'

// Memoized with stable callbacks, so a keystroke re-renders the input and entries, not the stacks.
function OmniRecordGroupsImpl({ data, term, onSelectRecord, onSeeAll, onHighlight, stale }: OmniRecordsProps) {
  const { stacks, more } = useMemo(() => groupRecordsByCustomer(data), [data])
  return (
    <>
      {stacks.map(stack => <OmniCustomerStack key={stack.customer.id} stack={stack} term={term} onSelect={onSelectRecord} onHighlight={onHighlight} stale={stale} />)}
      {more.length > 0 && (
        <CommandGroup heading={OMNI_COPY.moreCustomers}>
          {more.map(customer => <OmniCustomerItem key={customer.id} customer={customer} layout="compact" term={term} onSelect={onSelectRecord} onHighlight={onHighlight} disabled={stale} />)}
          {data.customers.length >= OMNI_LIMITS.customers && <OmniSeeAllItem href={data.seeAllHref} onSeeAll={onSeeAll} disabled={stale} />}
        </CommandGroup>
      )}
    </>
  )
}

export const OmniRecordGroups = memo(OmniRecordGroupsImpl)
